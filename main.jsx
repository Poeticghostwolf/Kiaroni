import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  doc,
  setDoc,
  getDoc,
  updateDoc
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDLwujgVQGVc9I909EkAkaal3BLobQTSBw",
  authDomain: "kiaroni.firebaseapp.com",
  projectId: "kiaroni"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function App() {
  const [tab, setTab] = useState("home");

  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState(null);
  const [userData, setUserData] = useState(null);

  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState("");

  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [chatText, setChatText] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const res = await signInAnonymously(auth);
      setUser(res.user);

      const userRef = doc(db, "users", res.user.uid);

      const snap = await getDoc(userRef);
      if (snap.exists()) setSavedUsername(snap.data().username);

      onSnapshot(userRef, (s) => {
        if (s.exists()) setUserData(s.data());
      });

      onSnapshot(query(collection(db, "posts")), (snap) => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });

      onSnapshot(query(collection(db, "messages")), (snap) => {
        setMessages(snap.docs.map(d => d.data()));
      });
    }

    init();
  }, []);

  async function saveUsername() {
    if (!username) return;

    await setDoc(doc(db, "users", user.uid), {
      username,
      following: [],
      followers: []
    });

    setSavedUsername(username);
  }

  async function createPost() {
    if (!text && !image) return;

    await addDoc(collection(db, "posts"), {
      text,
      image,
      userId: user.uid,
      username: savedUsername,
      likes: [],
      createdAt: Date.now()
    });

    setText("");
    setImage("");
  }

  async function sendMessage() {
    if (!chatText || !chatUser) return;

    await addDoc(collection(db, "messages"), {
      text: chatText,
      from: user.uid,
      to: chatUser.userId,
      username: savedUsername,
      createdAt: Date.now()
    });

    setChatText("");
  }

  function getConversations() {
    const map = {};

    messages.forEach(m => {
      if (m.from === user.uid || m.to === user.uid) {
        const otherId = m.from === user.uid ? m.to : m.from;

        if (!map[otherId]) {
          map[otherId] = {
            userId: otherId,
            username: m.username
          };
        }
      }
    });

    return Object.values(map);
  }

  function getChatMessages() {
    if (!chatUser) return [];

    return messages
      .filter(
        m =>
          (m.from === user.uid && m.to === chatUser.userId) ||
          (m.to === user.uid && m.from === chatUser.userId)
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function filteredPosts() {
    if (!userData) return posts;

    const following = userData.following || [];

    let base =
      following.length === 0
        ? posts
        : posts.filter(
            p =>
              following.includes(p.userId) ||
              p.userId === user.uid
          );

    return base
      .map(p => {
        const likes = (p.likes || []).length;
        const recency =
          Date.now() - p.createdAt < 3600000 ? 10 : 0;

        return { ...p, score: likes * 3 + recency };
      })
      .sort((a, b) => b.score - a.score);
  }

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;

  return (
    <div style={styles.app}>
      <div style={styles.container}>
        <h1>Kiaroni 🔥</h1>

        {!savedUsername && (
          <>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Choose username"
            />
            <button onClick={saveUsername}>Save</button>
          </>
        )}

        {/* HOME */}
        {tab === "home" && (
          <>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Post..."
            />
            <input
              value={image}
              onChange={e => setImage(e.target.value)}
              placeholder="Image URL"
            />
            <button onClick={createPost}>Post</button>

            {filteredPosts().map(p => (
              <div key={p.id} style={styles.card}>
                <strong
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setChatUser({
                      userId: p.userId,
                      username: p.username
                    });
                    setTab("chat");
                  }}
                >
                  @{p.username}
                </strong>

                <p>{p.text}</p>
                {p.image && <img src={p.image} style={styles.image} />}

                <button>
                  ❤️ {(p.likes || []).length}
                </button>
              </div>
            ))}
          </>
        )}

        {/* INBOX */}
        {tab === "chat" && !chatUser && (
          <>
            <h2>Messages</h2>

            {getConversations().length === 0 ? (
              <div style={styles.card}>
                <p>No messages yet</p>
                <p style={{ opacity: 0.7 }}>
                  Go to Home and tap a username to start chatting 👆
                </p>
              </div>
            ) : (
              getConversations().map(c => (
                <div
                  key={c.userId}
                  style={styles.card}
                  onClick={() => setChatUser(c)}
                >
                  💬 @{c.username}
                </div>
              ))
            )}
          </>
        )}

        {/* CHAT VIEW */}
        {tab === "chat" && chatUser && (
          <>
            <button onClick={() => setChatUser(null)}>← Back</button>

            <h2>@{chatUser.username}</h2>

            {getChatMessages().map((m, i) => (
              <p key={i}>
                <b>{m.from === user.uid ? "You" : m.username}</b>: {m.text}
              </p>
            ))}

            <input
              value={chatText}
              onChange={e => setChatText(e.target.value)}
              placeholder="Message..."
            />
            <button onClick={sendMessage}>Send</button>
          </>
        )}
      </div>

      <div style={styles.nav}>
        <button onClick={() => setTab("home")}>🏠</button>
        <button onClick={() => setTab("chat")}>💬</button>
      </div>
    </div>
  );
}

const styles = {
  app: {
    background: "#0f172a",
    minHeight: "100vh",
    color: "#fff"
  },
  container: {
    maxWidth: 500,
    margin: "auto",
    padding: 20
  },
  card: {
    background: "#1e293b",
    padding: 10,
    marginTop: 10,
    borderRadius: 10,
    cursor: "pointer"
  },
  image: {
    width: "100%",
    borderRadius: 10
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
