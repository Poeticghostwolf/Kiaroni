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
  const [preview, setPreview] = useState(null);

  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [chatText, setChatText] = useState("");

  const [notifications, setNotifications] = useState([]);
  const [popup, setPopup] = useState(null);

  const [users, setUsers] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [userData, setUserData] = useState(null);

  const [avatarFile, setAvatarFile] = useState(null);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    async function init() {
      const res = await signInAnonymously(auth);
      setUser(res.user);

      const userRef = doc(db, "users", res.user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) setSavedUsername(snap.data().username);

      onSnapshot(userRef, s => {
        if (s.exists()) setUserData(s.data());
      });

      onSnapshot(collection(db, "users"), snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      onSnapshot(collection(db, "posts"), snap => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      onSnapshot(collection(db, "messages"), snap => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      onSnapshot(collection(db, "notifications"), snap => {
        const data = snap.docs.map(d => d.data());
        const mine = data.filter(n => n.toUser === res.user.uid);
        setNotifications(mine);

        if (mine.length) {
          const latest = mine[mine.length - 1];
          setPopup(latest.text);
          setTimeout(() => setPopup(null), 3000);
        }
      });

      onSnapshot(collection(db, "reports"), snap => {
        setReports(snap.docs.map(d => d.data()));
      });
    }

    init();
  }, []);

  function getSmartFeed() {
    return [...posts]
      .map(p => {
        const likes = (p.likes || []).length;
        const age = Date.now() - p.createdAt;
        const recencyBoost = age < 3600000 ? 20 : 0;
        const score = likes * 10 + recencyBoost + Math.random() * 5;
        return { ...p, score };
      })
      .sort((a, b) => b.score - a.score);
  }

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

  function getUser(id) {
    return users.find(u => u.id === id) || {};
  }

  function getUserPosts(id) {
    return posts.filter(p => p.userId === id);
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

    await addDoc(collection(db, "notifications"), {
      text: `${savedUsername} messaged you`,
      toUser: chatUser.id,
      createdAt: Date.now()
    });
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
    setPreview(null);
  }

  async function toggleLike(post) {
    const refDoc = doc(db, "posts", post.id);
    const likes = post.likes || [];
    const updated = likes.includes(user.uid)
      ? likes.filter(id => id !== user.uid)
      : [...likes, user.uid];
    await updateDoc(refDoc, { likes: updated });
  }

  async function toggleFollow(targetId) {
    const myRef = doc(db, "users", user.uid);
    const theirRef = doc(db, "users", targetId);

    const mySnap = await getDoc(myRef);
    const theirSnap = await getDoc(theirRef);

    const following = mySnap.data()?.following || [];
    const followers = theirSnap.data()?.followers || [];

    if (following.includes(targetId)) {
      await updateDoc(myRef, {
        following: following.filter(id => id !== targetId)
      });
      await updateDoc(theirRef, {
        followers: followers.filter(id => id !== user.uid)
      });
    } else {
      await updateDoc(myRef, {
        following: [...following, targetId]
      });
      await updateDoc(theirRef, {
        followers: [...followers, user.uid]
      });
    }
  }

  async function uploadAvatar(file) {
    if (!file) return null;
    const storageRef = ref(storage, `avatars/${user.uid}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }

  async function updateProfile() {
    let avatarUrl = userData?.avatar || "";
    if (avatarFile) avatarUrl = await uploadAvatar(avatarFile);

    await updateDoc(doc(db, "users", user.uid), {
      avatar: avatarUrl
    });
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
                await setDoc(doc(db, "users", user.uid), {
                  username,
                  followers: [],
                  following: []
                });
                setSavedUsername(username);
              }}
            >
              Save
            </button>
          </>
        )}

        {popup && <div style={styles.popup}>{popup}</div>}

        {/* PROFILE VIEW */}
        {selectedProfile && (
          <>
            <button onClick={() => setSelectedProfile(null)}>← Back</button>
            <h2>@{selectedProfile.username}</h2>

            <p>
              Followers: {(getUser(selectedProfile.id).followers || []).length}
            </p>

            {selectedProfile.id !== user?.uid && (
              <button onClick={() => toggleFollow(selectedProfile.id)}>
                {userData?.following?.includes(selectedProfile.id)
                  ? "Unfollow"
                  : "Follow"}
              </button>
            )}

            {getUserPosts(selectedProfile.id).map(p => (
              <div key={p.id} style={styles.card}>
                {p.text}
              </div>
            ))}
          </>
        )}

        {/* HOME */}
        {!selectedProfile && tab === "home" && (
          <>
            <div style={styles.postBox}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="What's on your mind?"
              />

              <input
                type="file"
                onChange={e => {
                  const f = e.target.files[0];
                  setFile(f);
                  if (f) setPreview(URL.createObjectURL(f));
                }}
              />

              {preview && <img src={preview} style={styles.image} />}

              <button onClick={createPost}>Post</button>
            </div>

            {getSmartFeed().map(p => (
              <div key={p.id} style={styles.card}>
                <strong
                  onClick={() =>
                    setSelectedProfile({
                      id: p.userId,
                      username: p.username
                    })
                  }
                >
                  @{p.username}
                </strong>

                <p>{p.text}</p>

                <div style={styles.actions}>
                  <button onClick={() => toggleLike(p)}>
                    ❤️ {(p.likes || []).length}
                  </button>

                  <button
                    onClick={() =>
                      setChatUser({ id: p.userId, username: p.username })
                    }
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
                  >
                    🚨
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* INBOX */}
        {!selectedProfile && tab === "inbox" && (
          <>
            <h2>Messages</h2>
            {getConversations().map(id => (
              <div key={id} style={styles.card}>
                <button onClick={() => setChatUser({ id, username: id })}>
                  Chat with {id}
                </button>
              </div>
            ))}
          </>
        )}

        {/* NOTIFICATIONS */}
        {!selectedProfile && tab === "notifications" && (
          <>
            <h2>Notifications</h2>
            {notifications.map((n, i) => (
              <div key={i} style={styles.card}>
                {n.text}
              </div>
            ))}
          </>
        )}

        {/* PROFILE TAB */}
        {!selectedProfile && tab === "profile" && (
          <>
            <h2>Your Profile</h2>

            <input type="file" onChange={e => setAvatarFile(e.target.files[0])} />
            <button onClick={updateProfile}>Save Avatar</button>

            {userData?.avatar && (
              <img src={userData.avatar} style={styles.avatar} />
            )}
          </>
        )}

        {/* ADMIN */}
        {!selectedProfile && tab === "admin" && (
          <>
            <h2>Admin Panel</h2>
            {reports.map((r, i) => (
              <div key={i} style={styles.card}>
                <p>{r.postId}</p>
                <p>{r.reportedUser}</p>
              </div>
            ))}
          </>
        )}
      </div>

      {chatUser && (
        <div style={styles.chatBox}>
          <h4>@{chatUser.username}</h4>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {getChatMessages(chatUser.id).map(m => (
              <div key={m.id}>
                {m.from === user.uid ? "Me: " : "Them: "} {m.text}
              </div>
            ))}
          </div>

          <input value={chatText} onChange={e => setChatText(e.target.value)} />
          <button onClick={sendMessage}>Send</button>
          <button onClick={() => setChatUser(null)}>Close</button>
        </div>
      )}

      <div style={styles.nav}>
        {["home", "inbox", "notifications", "profile", "admin"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...styles.navBtn,
              color: tab === t ? "#6366f1" : "#fff"
            }}
          >
            {t === "home"
              ? "🏠"
              : t === "inbox"
              ? "💬"
              : t === "notifications"
              ? "🔔"
              : t === "profile"
              ? "👤"
              : "🛡"}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  app: { background: "#0f172a", minHeight: "100vh", color: "#fff" },
  container: { maxWidth: 800, margin: "auto", padding: 20 },
  postBox: { background: "#1e293b", padding: 10, borderRadius: 10 },
  card: { background: "#1e293b", padding: 10, marginTop: 10 },
  image: { width: "100%" },
  avatar: { width: 80, borderRadius: "50%" },
  actions: { display: "flex", gap: 10 },
  chatBox: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 300,
    height: 400,
    background: "#1e293b",
    padding: 10,
    display: "flex",
    flexDirection: "column"
  },
  nav: {
    position: "fixed",
    bottom: 0,
    width: "100%",
    display: "flex",
    justifyContent: "space-around",
    background: "#1e293b"
  },
  navBtn: { background: "none", border: "none", fontSize: 20 },
  popup: {
    position: "fixed",
    bottom: 70,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#6366f1",
    padding: "10px 20px",
    borderRadius: 10
  }
};

createRoot(document.getElementById("root")).render(<App />);
