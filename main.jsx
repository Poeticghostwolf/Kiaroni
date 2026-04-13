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

  const [notifications, setNotifications] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState({});

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
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPosts(data);
        setLoading(false);
      });

      onSnapshot(query(collection(db, "notifications")), (snap) => {
        const data = snap.docs.map(d => d.data());
        setNotifications(data.filter(n => n.toUser === res.user.uid));
      });

      onSnapshot(query(collection(db, "comments")), (snap) => {
        setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  async function toggleLike(post) {
    const ref = doc(db, "posts", post.id);
    const likes = post.likes || [];

    const updated = likes.includes(user.uid)
      ? likes.filter(id => id !== user.uid)
      : [...likes, user.uid];

    await updateDoc(ref, { likes: updated });
  }

  async function toggleFollow(targetId) {
    const myRef = doc(db, "users", user.uid);
    const theirRef = doc(db, "users", targetId);

    const mySnap = await getDoc(myRef);
    const theirSnap = await getDoc(theirRef);

    const myData = mySnap.data() || {};
    const theirData = theirSnap.data() || {};

    const following = myData.following || [];
    const followers = theirData.followers || [];

    const isFollowing = following.includes(targetId);

    if (isFollowing) {
      await setDoc(myRef, {
        ...myData,
        following: following.filter(id => id !== targetId)
      });

      await setDoc(theirRef, {
        ...theirData,
        followers: followers.filter(id => id !== user.uid)
      });
    } else {
      await setDoc(myRef, {
        ...myData,
        following: [...following, targetId]
      });

      await setDoc(theirRef, {
        ...theirData,
        followers: [...followers, user.uid]
      });
    }
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

  function myMessages() {
    if (!chatUser) return [];

    return messages.filter(
      m =>
        (m.from === user.uid && m.to === chatUser.userId) ||
        (m.to === user.uid && m.from === chatUser.userId)
    );
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
              placeholder="Username"
            />
            <button onClick={saveUsername}>Save</button>
          </>
        )}

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

                <button onClick={() => toggleLike(p)}>
                  ❤️ {(p.likes || []).length}
                </button>

                {p.userId !== user.uid && (
                  <button onClick={() => toggleFollow(p.userId)}>
                    Follow
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {tab === "chat" && chatUser && (
          <div>
            <h2>Chat with @{chatUser.username}</h2>

            {myMessages().map((m, i) => (
              <p key={i}>
                <b>{m.from === user.uid ? "You" : m.username}</b>: {m.text}
              </p>
            ))}

            <input
              value={chatText}
              onChange={e => setChatText(e.target.value)}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
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
