// src/main.jsx
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDLwujgVQGVc9I909EkAkaal3BLobQTSBw",
  authDomain: "kiaroni.firebaseapp.com",
  projectId: "kiaroni",
  storageBucket: "kiaroni.appspot.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

function App() {
  const [tab, setTab] = useState("home");

  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);

  const [usernameInput, setUsernameInput] = useState("");
  const [savedUsername, setSavedUsername] = useState("");

  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [reports, setReports] = useState([]);

  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");

  const [chatUser, setChatUser] = useState(null);
  const [chatText, setChatText] = useState("");
  const [messages, setMessages] = useState([]);

  const [popup, setPopup] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(null);

  useEffect(() => {
    let mounted = true;
    const unsubs = [];

    async function init() {
      try {
        const authResult = await signInAnonymously(auth);

        if (!mounted) return;

        const currentUser = authResult.user;
        setUser(currentUser);

        const userRef = doc(db, "users", currentUser.uid);

        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data();
          setUserData(data);
          setSavedUsername(data.username || "");
        }

        unsubs.push(
          onSnapshot(userRef, docSnap => {
            if (!docSnap.exists()) return;
            const data = docSnap.data();
            setUserData(data);
            setSavedUsername(data.username || "");
          })
        );

        unsubs.push(
          onSnapshot(collection(db, "users"), snap => {
            setUsers(
              snap.docs.map(d => ({
                id: d.id,
                ...d.data()
              }))
            );
          })
        );

        unsubs.push(
          onSnapshot(collection(db, "posts"), snap => {
            const data = snap.docs.map(d => ({
              id: d.id,
              ...d.data()
            }));

            data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            setPosts(data);
          })
        );

        unsubs.push(
          onSnapshot(collection(db, "notifications"), snap => {
            const mine = snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter(n => n.toUser === currentUser.uid)
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            setNotifications(mine);

            if (mine[0]) {
              setPopup(mine[0].text);

              setTimeout(() => {
                setPopup("");
              }, 3000);
            }
          })
        );

        unsubs.push(
          onSnapshot(collection(db, "reports"), snap => {
            setReports(
              snap.docs.map(d => ({
                id: d.id,
                ...d.data()
              }))
            );
          })
        );
      } catch (err) {
        console.error(err);
      }
    }

    init();

    return () => {
      mounted = false;
      unsubs.forEach(u => u && u());
    };
  }, []);

  useEffect(() => {
    if (!user || !chatUser) return;

    const q = query(
      collection(db, "messages"),
      where("participants", "array-contains", user.uid)
    );

    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(
          m =>
            m.participants?.includes(user.uid) &&
            m.participants?.includes(chatUser.id)
        )
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      setMessages(msgs);
    });

    return () => unsub();
  }, [user, chatUser]);

  const smartFeed = useMemo(() => {
    return [...posts]
      .map(post => {
        const likes = post.likes?.length || 0;
        const age = Date.now() - (post.createdAt || 0);

        let boost = 0;
        if (age < 3600000) boost = 20;
        else if (age < 86400000) boost = 8;

        return {
          ...post,
          score: likes * 10 + boost
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [posts]);

  async function createAccount() {
    if (!user || !usernameInput.trim()) return;

    try {
      const refDoc = doc(db, "users", user.uid);

      const allUsers = await getDocs(collection(db, "users"));
      const isFirstUser = allUsers.empty;

      await setDoc(refDoc, {
        username: usernameInput.trim(),
        isAdmin: isFirstUser,
        createdAt: Date.now(),
        followers: [],
        following: []
      });

      setSavedUsername(usernameInput.trim());
    } catch (err) {
      console.error(err);
    }
  }

  async function createPost() {
    if (!user || !savedUsername) return;
    if (!text.trim() && !file) return;

    try {
      let image = "";

      if (file) {
        const imageRef = ref(
          storage,
          `posts/${user.uid}/${Date.now()}_${file.name}`
        );

        await uploadBytes(imageRef, file);
        image = await getDownloadURL(imageRef);
      }

      await addDoc(collection(db, "posts"), {
        userId: user.uid,
        username: savedUsername,
        text: text.trim(),
        image,
        likes: [],
        createdAt: Date.now()
      });

      setText("");
      setFile(null);
      setPreview("");
    } catch (err) {
      console.error(err);
    }
  }

  async function toggleLike(post) {
    const likes = post.likes || [];
    const already = likes.includes(user.uid);

    const updated = already
      ? likes.filter(id => id !== user.uid)
      : [...likes, user.uid];

    await updateDoc(doc(db, "posts", post.id), {
      likes: updated
    });

    if (!already && post.userId !== user.uid) {
      await addDoc(collection(db, "notifications"), {
        toUser: post.userId,
        text: `${savedUsername} liked your post`,
        createdAt: Date.now()
      });
    }
  }

  async function reportPost(post) {
    await addDoc(collection(db, "reports"), {
      postId: post.id,
      reportedBy: user.uid,
      reportedUser: post.userId,
      text: post.text || "",
      createdAt: Date.now()
    });

    setPopup("Report submitted");

    setTimeout(() => {
      setPopup("");
    }, 2000);
  }

  async function sendMessage() {
    if (!chatUser || !chatText.trim()) return;

    await addDoc(collection(db, "messages"), {
      from: user.uid,
      to: chatUser.id,
      text: chatText.trim(),
      participants: [user.uid, chatUser.id],
      createdAt: Date.now()
    });

    setChatText("");
  }

  return (
    <div style={styles.app}>
      <div style={styles.overlay}>
        <header style={styles.header}>
          <img
            src="/kiaroni-logo-dark.png"
            alt="Kiaroni"
            style={styles.logo}
          />
        </header>

        <main style={styles.container}>
          {!savedUsername && (
            <div style={styles.card}>
              <h2>Create your account</h2>

              <input
                style={styles.input}
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                placeholder="Username"
              />

              <button style={styles.primaryButton} onClick={createAccount}>
                Continue
              </button>
            </div>
          )}

          {popup && <div style={styles.popup}>{popup}</div>}

          {savedUsername && tab === "home" && (
            <>
              <div style={styles.card}>
                <textarea
                  style={styles.textarea}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Post something..."
                />

                <input
                  type="file"
                  accept="image/*"
                  style={styles.input}
                  onChange={e => {
                    const chosen = e.target.files?.[0];
                    setFile(chosen || null);

                    if (chosen) {
                      setPreview(URL.createObjectURL(chosen));
                    }
                  }}
                />

                {preview && (
                  <img
                    src={preview}
                    alt="Preview"
                    style={styles.postImage}
                  />
                )}

                <button style={styles.primaryButton} onClick={createPost}>
                  Post
                </button>
              </div>

              {smartFeed.map(post => (
                <div key={post.id} style={styles.card}>
                  <button
                    style={styles.username}
                    onClick={() => setSelectedProfile(post.userId)}
                  >
                    @{post.username}
                  </button>

                  <p>{post.text}</p>

                  {post.image && (
                    <img
                      src={post.image}
                      alt=""
                      style={styles.postImage}
                    />
                  )}

                  <div style={styles.actions}>
                    <button
                      style={styles.actionButton}
                      onClick={() => toggleLike(post)}
                    >
                      {(post.likes || []).includes(user.uid) ? "❤️" : "🤍"}{" "}
                      {(post.likes || []).length}
                    </button>

                    <button
                      style={styles.actionButton}
                      onClick={() =>
                        setChatUser({
                          id: post.userId,
                          username: post.username
                        })
                      }
                    >
                      💬
                    </button>

                    <button
                      style={styles.actionButton}
                      onClick={() => reportPost(post)}
                    >
                      🚨
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {savedUsername && tab === "profile" && (
            <div style={styles.card}>
              <h2>@{savedUsername}</h2>
              <p>{user?.uid}</p>

              {userData?.isAdmin && (
                <>
                  <h3>Admin Reports</h3>

                  {reports.map(report => (
                    <div key={report.id} style={styles.report}>
                      <p><strong>Post:</strong> {report.postId}</p>
                      <p><strong>By:</strong> {report.reportedBy}</p>
                    </div>
                  ))}
                </>
              )}

              <h3>Notifications</h3>

              {notifications.map(n => (
                <div key={n.id} style={styles.notification}>
                  {n.text}
                </div>
              ))}
            </div>
          )}
        </main>

        {chatUser && (
          <div style={styles.chatOverlay}>
            <div style={styles.chatBox}>
              <div style={styles.chatHeader}>
                <strong>@{chatUser.username}</strong>

                <button
                  style={styles.closeButton}
                  onClick={() => setChatUser(null)}
                >
                  ✕
                </button>
              </div>

              <div style={styles.chatMessages}>
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    style={
                      msg.from === user.uid
                        ? styles.myMessage
                        : styles.theirMessage
                    }
                  >
                    {msg.text}
                  </div>
                ))}
              </div>

              <div style={styles.chatInputRow}>
                <input
                  style={styles.chatInput}
                  value={chatText}
                  onChange={e => setChatText(e.target.value)}
                  placeholder="Message..."
                />

                <button style={styles.primaryButton} onClick={sendMessage}>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {savedUsername && (
          <nav style={styles.nav}>
            <button
              style={tab === "home" ? styles.activeNav : styles.navButton}
              onClick={() => setTab("home")}
            >
              🏠
            </button>

            <button
              style={tab === "profile" ? styles.activeNav : styles.navButton}
              onClick={() => setTab("profile")}
            >
              👤
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "url('/kiaroni-bg.jpg') center / cover no-repeat fixed"
  },

  overlay: {
    minHeight: "100vh",
    background:
      "linear-gradient(rgba(7,10,24,0.82), rgba(7,10,24,0.92))",
    color: "white",
    paddingBottom: 90
  },

  header: {
    display: "flex",
    justifyContent: "center",
    paddingTop: 24,
    paddingBottom: 12
  },

  logo: {
    width: 260,
    maxWidth: "90%"
  },

  container: {
    maxWidth: 640,
    margin: "0 auto",
    padding: 16
  },

  card: {
    background: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    backdropFilter: "blur(12px)"
  },

  input: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "none",
    marginBottom: 12,
    boxSizing: "border-box"
  },

  textarea: {
    width: "100%",
    minHeight: 120,
    padding: 12,
    borderRadius: 12,
    border: "none",
    marginBottom: 12,
    resize: "vertical",
    boxSizing: "border-box"
  },

  primaryButton: {
    border: "none",
    borderRadius: 12,
    padding: "12px 18px",
    background: "linear-gradient(135deg,#8b5cf6,#38bdf8)",
    color: "white",
    cursor: "pointer"
  },

  popup: {
    background: "linear-gradient(135deg,#8b5cf6,#38bdf8)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12
  },

  username: {
    background: "none",
    border: "none",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: 18
  },

  postImage: {
    width: "100%",
    borderRadius: 14,
    marginTop: 10,
    marginBottom: 10
  },

  actions: {
    display: "flex",
    gap: 10
  },

  actionButton: {
    border: "none",
    borderRadius: 10,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer"
  },

  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    gap: 14,
    padding: 14,
    background: "rgba(7,10,24,0.92)"
  },

  navButton: {
    border: "none",
    background: "transparent",
    color: "#cbd5e1",
    fontSize: 24,
    cursor: "pointer"
  },

  activeNav: {
    border: "none",
    borderRadius: 12,
    padding: 10,
    background: "linear-gradient(135deg,#8b5cf6,#38bdf8)",
    color: "white",
    fontSize: 24,
    cursor: "pointer"
  },

  chatOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 16
  },

  chatBox: {
    width: "100%",
    maxWidth: 520,
    height: "70vh",
    background: "#111827",
    borderRadius: 18,
    display: "flex",
    flexDirection: "column"
  },

  chatHeader: {
    display: "flex",
    justifyContent: "space-between",
    padding: 14,
    borderBottom: "1px solid rgba(255,255,255,0.08)"
  },

  closeButton: {
    background: "transparent",
    border: "none",
    color: "white",
    fontSize: 20,
    cursor: "pointer"
  },

  chatMessages: {
    flex: 1,
    overflowY: "auto",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10
  },

  myMessage: {
    alignSelf: "flex-end",
    background: "linear-gradient(135deg,#8b5cf6,#38bdf8)",
    padding: 10,
    borderRadius: 14,
    maxWidth: "70%"
  },

  theirMessage: {
    alignSelf: "flex-start",
    background: "rgba(255,255,255,0.08)",
    padding: 10,
    borderRadius: 14,
    maxWidth: "70%"
  },

  chatInputRow: {
    display: "flex",
    gap: 10,
    padding: 14
  },

  chatInput: {
    flex: 1,
    borderRadius: 12,
    border: "none",
    padding: 12
  },

  report: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10
  },

  notification: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10
  }
};

createRoot(document.getElementById("root")).render(<App />);
