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

  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  const [animatingLike, setAnimatingLike] = useState(null);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [commentText, setCommentText] = useState({});
  const [comments, setComments] = useState([]);

  useEffect(() => {
    async function init() {
      const res = await signInAnonymously(auth);
      setUser(res.user);

      const userRef = doc(db, "users", res.user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setSavedUsername(userSnap.data().username);
      }

      // POSTS
      const q = query(collection(db, "posts"));
      onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        data.sort((a, b) => {
          const trustA = a.trustScore || 50;
          const trustB = b.trustScore || 50;

          const likesA = (a.likes || []).length;
          const likesB = (b.likes || []).length;

          const trendA = trustA + likesA * 3;
          const trendB = trustB + likesB * 3;

          if (trendA === trendB) {
            return b.createdAt - a.createdAt;
          }

          return trendB - trendA;
        });

        setPosts(data);
        setLoading(false);
      });

      // NOTIFICATIONS
      const notifQuery = query(collection(db, "notifications"));
      onSnapshot(notifQuery, (snapshot) => {
        const data = snapshot.docs.map(d => d.data());
        const mine = data.filter(n => n.toUser === res.user.uid);

        setNotifications(mine);
        setUnreadCount(mine.length);
      });

      // COMMENTS
      const commentQuery = query(collection(db, "comments"));
      onSnapshot(commentQuery, (snapshot) => {
        const data = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        setComments(data);
      });
    }

    init();
  }, []);

  async function updateTrust(userId, amount) {
    const ref = doc(db, "users", userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const current = snap.data().trustScore || 50;

    await setDoc(ref, {
      ...snap.data(),
      trustScore: current + amount
    });
  }

  async function toggleLike(post) {
    const ref = doc(db, "posts", post.id);
    const currentLikes = post.likes || [];

    let updatedLikes;

    if (currentLikes.includes(user.uid)) {
      updatedLikes = currentLikes.filter(id => id !== user.uid);
    } else {
      updatedLikes = [...currentLikes, user.uid];

      await updateTrust(post.userId, 1);

      if (post.userId !== user.uid) {
        await addDoc(collection(db, "notifications"), {
          type: "like",
          toUser: post.userId,
          fromUser: savedUsername,
          createdAt: Date.now()
        });
      }
    }

    setAnimatingLike(post.id);
    setTimeout(() => setAnimatingLike(null), 200);

    await updateDoc(ref, { likes: updatedLikes });
  }

  async function addComment(postId, postUserId) {
    const text = commentText[postId];
    if (!text) return;

    await addDoc(collection(db, "comments"), {
      postId,
      text,
      username: savedUsername,
      createdAt: Date.now()
    });

    if (postUserId !== user.uid) {
      await addDoc(collection(db, "notifications"), {
        type: "comment",
        toUser: postUserId,
        fromUser: savedUsername,
        text,
        createdAt: Date.now()
      });
    }

    setCommentText(prev => ({ ...prev, [postId]: "" }));
  }

  async function createPost() {
    if (!text) return;

    await addDoc(collection(db, "posts"), {
      text,
      userId: user.uid,
      username: savedUsername,
      likes: [],
      trustScore: 50,
      createdAt: Date.now()
    });

    await updateTrust(user.uid, 1);
    setText("");
  }

  function myPosts() {
    return posts.filter(p => p.userId === user.uid);
  }

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Kiaroni 🔥</h1>

      {/* HOME */}
      {tab === "home" && (
        <>
          <div style={styles.card}>
            <input
              style={styles.input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's happening?"
            />
            <button style={styles.primaryBtn} onClick={createPost}>
              Post
            </button>
          </div>

          {posts.map(p => (
            <div key={p.id} style={styles.card}>
              <strong>@{p.username}</strong>
              <p>{p.text}</p>

              <button onClick={() => toggleLike(p)}>
                ❤️ {(p.likes || []).length}
              </button>

              <div>
                <input
                  value={commentText[p.id] || ""}
                  onChange={(e) =>
                    setCommentText({
                      ...commentText,
                      [p.id]: e.target.value
                    })
                  }
                />
                <button onClick={() => addComment(p.id, p.userId)}>
                  Reply
                </button>

                {comments
                  .filter(c => c.postId === p.id)
                  .map(c => (
                    <p key={c.id}>
                      @{c.username}: {c.text}
                    </p>
                  ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* NOTIFICATIONS */}
      {tab === "notifications" && (
        <div style={styles.card}>
          <h2>🔔 Notifications</h2>
          {notifications.map((n, i) => (
            <p key={i}>
              {n.type === "like" && `❤️ ${n.fromUser} liked your post`}
              {n.type === "comment" && `💬 ${n.fromUser}: ${n.text}`}
            </p>
          ))}
        </div>
      )}

      {/* PROFILE */}
      {tab === "profile" && (
        <div style={styles.card}>
          <h2>@{savedUsername}</h2>
          {myPosts().map(p => (
            <p key={p.id}>{p.text}</p>
          ))}
        </div>
      )}

      {/* BOTTOM NAV */}
      <div style={styles.nav}>
        <button onClick={() => setTab("home")}>🏠</button>
        <button onClick={() => setTab("notifications")}>
          🔔 {unreadCount > 0 && `(${unreadCount})`}
        </button>
        <button onClick={() => setTab("profile")}>👤</button>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: 20, color: "#fff", background: "#0f172a", minHeight: "100vh" },
  title: { textAlign: "center" },
  card: { background: "#1e293b", padding: 15, marginTop: 10, borderRadius: 10 },
  input: { width: "100%", marginBottom: 10 },
  primaryBtn: { width: "100%" },
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "space-around",
    background: "#1e293b",
    padding: 10
  }
};

createRoot(document.getElementById("root")).render(<App />);
