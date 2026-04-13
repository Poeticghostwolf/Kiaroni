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
  projectId: "kiaroni"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

function App() {
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

      // ✅ FIXED MESSAGES
      onSnapshot(collection(db, "messages"), snap => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    init();
  }, []);

  // ✅ CHAT FILTER
  function getChatMessages() {
    if (!chatUser || !user) return [];

    return messages
      .filter(
        m =>
          (m.from === user.uid && m.to === chatUser.id) ||
          (m.from === chatUser.id && m.to === user.uid)
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  // ✅ SEND MESSAGE
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

  // ✅ SAFE LIKE
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
                await setDoc(doc(db, "users", user.uid), {
                  username
                });
                setSavedUsername(username);
              }}
            >
              Save
            </button>
          </>
        )}

        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Post..."
        />
        <input type="file" onChange={e => setFile(e.target.files[0])} />
        <button onClick={createPost}>Post</button>

        {posts.map(p => (
          <div key={p.id} style={styles.card}>
            <strong>@{p.username}</strong>
            <p>{p.text}</p>

            {p.image && <img src={p.image} style={styles.image} />}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => toggleLike(p)}
                style={styles.likeBtn}
              >
                {(p.likes || []).includes(user?.uid) ? "❤️" : "🤍"}{" "}
                {(p.likes || []).length}
              </button>

              <button onClick={() => setChatUser({ id: p.userId, username: p.username })}>
                💬
              </button>

              <button
                onClick={async () => {
                  await addDoc(collection(db, "reports"), {
                    postId: p.id,
                    reportedUser: p.userId,
                    reportedBy: user.uid,
                    text: p.text,
                    createdAt: Date.now()
                  });

                  setNotifications(prev => [
                    ...prev,
                    { text: "Report submitted", local: true }
                  ]);
                }}
              >
                🚨
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ✅ CHAT UI */}
      {chatUser && (
        <div style={styles.chatBox}>
          <h4>@{chatUser.username}</h4>

          <div style={{ flex: 1, overflowY: "auto", marginBottom: 10 }}>
            {getChatMessages().map(m => (
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
                    padding: "6px 10px",
                    borderRadius: 10,
                    display: "inline-block"
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
    </div>
  );
}

const styles = {
  app: { background: "#0f172a", minHeight: "100vh", color: "#fff" },

  container: {
    maxWidth: 800,
    margin: "auto",
    padding: 20
  },

  card: {
    background: "#1e293b",
    padding: 10,
    marginTop: 10,
    borderRadius: 10
  },

  image: {
    width: "100%",
    borderRadius: 10
  },

  likeBtn: {
    background: "none",
    border: "none",
    fontSize: 16,
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
    zIndex: 999,
    display: "flex",
    flexDirection: "column"
  }
};

createRoot(document.getElementById("root")).render(<App />);
