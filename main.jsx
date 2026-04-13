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

  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState("");

  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [chatText, setChatText] = useState("");

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  const [notifications, setNotifications] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const res = await signInAnonymously(auth);
      setUser(res.user);

      const userRef = doc(db, "users", res.user.uid);

      const snap = await getDoc(userRef);
      if (snap.exists()) setSavedUsername(snap.data().username);

      onSnapshot(collection(db, "users"), snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      onSnapshot(collection(db, "posts"), snap => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });

      onSnapshot(collection(db, "messages"), snap => {
        setMessages(snap.docs.map(d => d.data()));
      });

      onSnapshot(collection(db, "notifications"), snap => {
        const data = snap.docs.map(d => d.data());
        setNotifications(data.filter(n => n.toUser === res.user.uid));
      });
    }

    init();
  }, []);

  async function saveUsername() {
    if (!username) return;

    await setDoc(doc(db, "users", user.uid), {
      username
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

  async function toggleLike(post) {
    const ref = doc(db, "posts", post.id);
    const likes = post.likes || [];

    const isLiked = likes.includes(user.uid);

    const updated = isLiked
      ? likes.filter(id => id !== user.uid)
      : [...likes, user.uid];

    await updateDoc(ref, { likes: updated });

    // 🔔 NOTIFY (only when liking, not unliking)
    if (!isLiked && post.userId !== user.uid) {
      await addDoc(collection(db, "notifications"), {
        text: `${savedUsername} liked your post`,
        toUser: post.userId,
        createdAt: Date.now()
      });
    }
  }

  async function sendMessage() {
    if (!chatText || !chatUser) return;

    await addDoc(collection(db, "messages"), {
      text: chatText,
      from: user.uid,
      to: chatUser.id,
      username: savedUsername,
      createdAt: Date.now()
    });

    await addDoc(collection(db, "notifications"), {
      text: `${savedUsername} sent you a message`,
      toUser: chatUser.id,
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

    return messages.filter(
      m =>
        (m.from === user.uid && m.to === chatUser.id) ||
        (m.to === user.uid && m.from === chatUser.id)
    );
  }

  function searchResults() {
    return users.filter(u =>
      u.username?.toLowerCase().includes(search.toLowerCase())
    );
  }

  if (loading) return <p>Loading...</p>;

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

            {posts.map(p => {
              const isLiked = (p.likes || []).includes(user.uid);

              return (
                <div key={p.id} style={styles.card}>
                  <strong
                    onClick={() => {
                      setChatUser({ id: p.userId, username: p.username });
                      setTab("chat");
                    }}
                  >
                    @{p.username}
                  </strong>

                  <p>{p.text}</p>
                  {p.image && <img src={p.image} style={styles.image} />}

                  <button onClick={() => toggleLike(p)}>
                    {isLiked ? "💖" : "🤍"} {(p.likes || []).length}
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* SEARCH */}
        {tab === "search" && (
          <>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users..."
            />

            {searchResults().map(u => (
              <div
                key={u.id}
                style={styles.card}
                onClick={() => {
                  setChatUser(u);
                  setTab("chat");
                }}
              >
                🔍 @{u.username}
              </div>
            ))}
          </>
        )}

        {/* NOTIFICATIONS */}
        {tab === "notifications" && (
          <>
            <h2>Notifications</h2>

            {notifications.length === 0 ? (
              <div style={styles.card}>No notifications yet</div>
            ) : (
              notifications.map((n, i) => (
                <div key={i} style={styles.card}>
                  🔔 {n.text}
                </div>
              ))
            )}
          </>
        )}

        {/* INBOX */}
        {tab === "chat" && !chatUser && (
          <>
            <h2>Messages</h2>

            {getConversations().length === 0 ? (
              <div style={styles.card}>
                No messages yet — search users 🔍
              </div>
            ) : (
              getConversations().map(c => (
                <div
                  key={c.userId}
                  style={styles.card}
                  onClick={() => setChatUser({ id: c.userId, username: c.username })}
                >
                  💬 @{c.username}
                </div>
              ))
            )}
          </>
        )}

        {/* CHAT */}
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
        <button onClick={() => setTab("search")}>🔍</button>
        <button onClick={() => setTab("chat")}>💬</button>
        <button onClick={() => setTab("notifications")}>🔔</button>
      </div>
    </div>
  );
}

const styles = {
  app: { background: "#0f172a", minHeight: "100vh", color: "#fff" },
  container: { maxWidth: 500, margin: "auto", padding: 20 },
  card: {
    background: "#1e293b",
    padding: 10,
    marginTop: 10,
    borderRadius: 10
  },
  image: { width: "100%", borderRadius: 10 },
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
