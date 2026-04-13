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
  apiKey: "AIzaSy...",
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

      // 🔔 Notifications
      onSnapshot(collection(db, "notifications"), snap => {
        const data = snap.docs.map(d => d.data());
        setNotifications(data.filter(n => n.toUser === res.user.uid));
      });
    }

    init();
  }, []);

  // 💬 FILTER CHAT
  function getChatMessages(userId) {
    return messages
      .filter(
        m =>
          (m.from === user.uid && m.to === userId) ||
          (m.from === userId && m.to === user.uid)
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  // 💬 GET CONVERSATIONS (INBOX)
  function getConversations() {
    const map = {};

    messages.forEach(m => {
      if (m.from === user.uid) map[m.to] = true;
      if (m.to === user.uid) map[m.from] = true;
    });

    return Object.keys(map);
  }

  // 💬 SEND MESSAGE
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
      text: `${savedUsername} sent you a message`,
      toUser: chatUser.id,
      createdAt: Date.now()
    });
  }

  // 📝 CREATE POST
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

  // ❤️ LIKE
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
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Post..." />
            <input type="file" onChange={e => setFile(e.target.files[0])} />
            <button onClick={createPost}>Post</button>

            {posts.map(p => (
              <div key={p.id} style={styles.card}>
                <strong>@{p.username}</strong>
                <p>{p.text}</p>

                <div style={styles.actions}>
                  <button onClick={() => toggleLike(p)}>❤️ {(p.likes || []).length}</button>
                  <button onClick={() => setChatUser({ id: p.userId, username: p.username })}>💬</button>
                  <button onClick={() => addDoc(collection(db, "reports"), {
                    postId: p.id,
                    reportedUser: p.userId,
                    reportedBy: user.uid,
                    createdAt: Date.now()
                  })}>🚨</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* 💬 INBOX TAB */}
        {tab === "inbox" && (
          <>
            <h2>Messages</h2>
            {getConversations().map(id => (
              <div key={id} style={styles.card}>
                <button onClick={() => setChatUser({ id })}>
                  Open chat with {id}
                </button>
              </div>
            ))}
          </>
        )}

        {/* 🔔 NOTIFICATIONS */}
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

        {/* 👤 PROFILE */}
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
          <h4>{chatUser.username || chatUser.id}</h4>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {getChatMessages(chatUser.id).map(m => (
              <div key={m.id}>
                <b>{m.from === user.uid ? "Me" : "Them"}:</b> {m.text}
              </div>
            ))}
          </div>

          <input value={chatText} onChange={e => setChatText(e.target.value)} />
          <button onClick={sendMessage}>Send</button>
          <button onClick={() => setChatUser(null)}>Close</button>
        </div>
      )}

      {/* NAV */}
      <div style={styles.nav}>
        <button onClick={() => setTab("home")}>🏠</button>
        <button onClick={() => setTab("inbox")}>💬</button>
        <button onClick={() => setTab("notifications")}>🔔</button>
        <button onClick={() => setTab("profile")}>👤</button>
      </div>
    </div>
  );
}

const styles = {
  app: { background: "#0f172a", minHeight: "100vh", color: "#fff" },
  container: { maxWidth: 800, margin: "auto", padding: 20 },
  card: { background: "#1e293b", padding: 10, marginTop: 10, borderRadius: 10 },
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
    background: "#1e293b",
    padding: 10
  }
};

createRoot(document.getElementById("root")).render(<App />);
