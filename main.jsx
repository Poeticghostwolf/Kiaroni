import React, { useEffect, useState } from "react";
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
  updateDoc
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
  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState(null);

  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);

  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [chatText, setChatText] = useState("");

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    async function init() {
      const res = await signInAnonymously(auth);
      setUser(res.user);

      const userRef = doc(db, "users", res.user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) setSavedUsername(snap.data().username);

      onSnapshot(collection(db, "posts"), snap => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      onSnapshot(collection(db, "messages"), snap => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      onSnapshot(collection(db, "notifications"), snap => {
        const data = snap.docs.map(d => d.data());
        setNotifications(data.filter(n => n.toUser === res.user.uid));
      });
    }

    init();
  }, []);

  function getChatMessages(userId) {
    if (!user) return [];

    return messages
      .filter(
        m =>
          (m.from === user.uid && m.to === userId) ||
          (m.from === userId && m.to === user.uid)
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function getConversations() {
    if (!user) return [];
    const map = {};

    messages.forEach(m => {
      if (m.from === user.uid) map[m.to] = true;
      if (m.to === user.uid) map[m.from] = true;
    });

    return Object.keys(map);
  }

  async function sendMessage() {
    if (!chatText.trim() || !chatUser) return;

    await addDoc(collection(db, "messages"), {
      text: chatText,
      from: user.uid,
      to: chatUser.id,
      createdAt: Date.now()
    });

    setChatText("");
  }

  async function createPost() {
    if (!text && !file) return;

    let imageUrl = "";
    if (file) {
      const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      imageUrl = await getDownloadURL(storageRef);
    }

    await addDoc(collection(db, "posts"), {
      text,
      image: imageUrl,
      userId: user.uid,
      username: savedUsername,
      likes: [],
      createdAt: Date.now()
    });

    setText("");
    setFile(null);
  }

  async function toggleLike(post) {
    if (!user) return;

    const refDoc = doc(db, "posts", post.id);
    const likes = post.likes || [];

    const isLiked = likes.includes(user.uid);

    const updated = isLiked
      ? likes.filter(id => id !== user.uid)
      : [...likes, user.uid];

    await updateDoc(refDoc, { likes: updated });
  }

  return (
    <div style={styles.app}>
      <div style={styles.container}>
        <h1>Kiaroni 🔥</h1>

        {!savedUsername && (
          <>
            <input value={username} onChange={e => setUsername(e.target.value)} />
            <button
              onClick={async () => {
                if (!username) return;
                await setDoc(doc(db, "users", user.uid), { username });
                setSavedUsername(username);
              }}
            >
              Save
            </button>
          </>
        )}

        {/* HOME */}
        {tab === "home" && (
          <>
            <div style={styles.postBox}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="What's on your mind?"
                style={styles.textarea}
              />

              <div style={styles.postActions}>
                <input type="file" onChange={e => setFile(e.target.files[0])} />
                <button onClick={createPost} style={styles.postBtn}>
                  Post
                </button>
              </div>
            </div>

            {posts.map(p => (
              <div key={p.id} style={styles.card}>
                <strong>@{p.username}</strong>
                <p>{p.text}</p>

                {p.image && <img src={p.image} style={styles.image} />}

                <div style={styles.actions}>
                  <button onClick={() => toggleLike(p)} style={styles.actionBtn}>
                    {(p.likes || []).includes(user?.uid) ? "❤️" : "🤍"} {(p.likes || []).length}
                  </button>

                  <button
                    onClick={() =>
                      setChatUser({ id: p.userId, username: p.username })
                    }
                    style={styles.actionBtn}
                  >
                    💬
                  </button>

                  <button
                    onClick={() =>
                      addDoc(collection(db, "reports"), {
                        postId: p.id,
                        reportedUser: p.userId,
                        reportedBy: user.uid,
                        createdAt: Date.now()
                      })
                    }
                    style={styles.actionBtn}
                  >
                    🚨
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* INBOX */}
        {tab === "inbox" && (
          <>
            <h2>Messages</h2>
            {getConversations().map(id => (
              <div key={id} style={styles.card}>
                <button
                  onClick={() => setChatUser({ id, username: id })}
                  style={styles.actionBtn}
                >
                  Chat with {id}
                </button>
              </div>
            ))}
          </>
        )}

        {/* NOTIFICATIONS */}
        {tab === "notifications" && (
          <>
            <h2>Notifications</h2>
            {notifications.map((n, i) => (
              <div key={i} style={styles.card}>
                {n.text}
              </div>
            ))}
          </>
        )}

        {/* PROFILE */}
        {tab === "profile" && (
          <>
            <h2>Your Profile</h2>
            <p>@{savedUsername}</p>
          </>
        )}
      </div>

      {/* CHAT MODAL */}
      {chatUser && (
        <div style={styles.chatBox}>
          <h4>@{chatUser.username}</h4>

          <div style={{ flex: 1, overflowY: "auto", paddingRight: 5 }}>
            {getChatMessages(chatUser.id).map(m => (
              <div
                key={m.id}
                style={{
                  textAlign: m.from === user.uid ? "right" : "left",
                  marginBottom: 6
                }}
              >
                <span
                  style={{
                    background:
                      m.from === user.uid ? "#6366f1" : "#334155",
                    padding: "8px 12px",
                    borderRadius: 12,
                    display: "inline-block",
                    maxWidth: "70%"
                  }}
                >
                  {m.text}
                </span>
              </div>
            ))}
          </div>

          <input
            value={chatText}
            onChange={e => setChatText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
          />
          <button onClick={sendMessage}>Send</button>
          <button onClick={() => setChatUser(null)}>Close</button>
        </div>
      )}

      {/* NAV */}
      <div style={styles.nav}>
        {[
          { id: "home", icon: "🏠" },
          { id: "inbox", icon: "💬" },
          { id: "notifications", icon: "🔔" },
          { id: "profile", icon: "👤" }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              ...styles.navBtn,
              color: tab === t.id ? "#6366f1" : "#fff"
            }}
          >
            {t.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  app: {
    background: "linear-gradient(to bottom, #0f172a, #1e3a8a)",
    minHeight: "100vh",
    color: "#fff"
  },

  container: {
    maxWidth: 800,
    margin: "auto",
    padding: 20
  },

  postBox: {
    background: "#1e293b",
    padding: 10,
    borderRadius: 10,
    marginBottom: 15
  },

  textarea: {
    width: "100%",
    minHeight: 60,
    background: "transparent",
    border: "none",
    color: "#fff",
    outline: "none"
  },

  postActions: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 10
  },

  postBtn: {
    background: "#6366f1",
    border: "none",
    padding: "6px 12px",
    borderRadius: 6,
    color: "#fff"
  },

  card: {
    background: "rgba(30,41,59,0.9)",
    padding: 15,
    marginTop: 15,
    borderRadius: 15
  },

  image: {
    width: "100%",
    borderRadius: 10
  },

  actions: {
    display: "flex",
    gap: 15,
    marginTop: 10
  },

  actionBtn: {
    background: "none",
    border: "none",
    color: "#fff",
    cursor: "pointer"
  },

  chatBox: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 350,
    height: 400,
    background: "#1e293b",
    padding: 15,
    borderRadius: 15,
    display: "flex",
    flexDirection: "column"
  },

  nav: {
    position: "fixed",
    bottom: 0,
    width: "100%",
    display: "flex",
    justifyContent: "space-around",
    background: "#1e293b",
    padding: 10
  },

  navBtn: {
    background: "none",
    border: "none",
    fontSize: 20,
    cursor: "pointer"
  }
};

createRoot(document.getElementById("root")).render(<App />);
