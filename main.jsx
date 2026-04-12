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
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState(null);

  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  const [viewProfile, setViewProfile] = useState(null);

  useEffect(() => {
    async function init() {
      const res = await signInAnonymously(auth);
      setUser(res.user);

      const userRef = doc(db, "users", res.user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setSavedUsername(userSnap.data().username);
      }

      const q = query(collection(db, "posts"));

      onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        // 🔥 TRENDING SORT
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
    }

    await updateDoc(ref, {
      likes: updatedLikes
    });
  }

  async function reportPost(post) {
    await updateTrust(post.userId, -5);

    await addDoc(collection(db, "reports"), {
      postId: post.id,
      reportedUser: post.userId,
      createdAt: Date.now()
    });
  }

  async function saveUsername() {
    if (!username) return;

    await setDoc(doc(db, "users", user.uid), {
      username,
      trustScore: 50
    });

    setSavedUsername(username);
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

  function profilePosts() {
    return posts.filter(p => p.userId === viewProfile.userId);
  }

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;

  // PROFILE PAGE
  if (viewProfile) {
    return (
      <div style={styles.page}>
        <button style={styles.backBtn} onClick={() => setViewProfile(null)}>
          ← Back
        </button>

        <h2>@{viewProfile.username}</h2>

        {profilePosts().map(p => (
          <div key={p.id} style={styles.card}>
            <p>{p.text}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Kiaroni 🔥</h1>

      {!savedUsername ? (
        <div style={styles.card}>
          <input
            style={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose username"
          />
          <button style={styles.button} onClick={saveUsername}>
            Save
          </button>
        </div>
      ) : (
        <p style={{ marginBottom: 20 }}>@{savedUsername}</p>
      )}

      <div style={styles.card}>
        <input
          style={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's happening?"
        />
        <button style={styles.button} onClick={createPost}>
          Post
        </button>
      </div>

      {posts.map(p => {
        const liked = (p.likes || []).includes(user.uid);

        return (
          <div key={p.id} style={styles.card}>

            {(p.trustScore || 50) < 40 ? (
              <div style={styles.warning}>
                ⚠️ This post is hidden due to low trust
              </div>
            ) : (
              <>
                <div style={styles.header}>
                  <span
                    style={styles.username}
                    onClick={() =>
                      setViewProfile({ userId: p.userId, username: p.username })
                    }
                  >
                    @{p.username} ⭐ {p.trustScore || 50}
                    {(p.trustScore || 50) >= 80 && " 👑"}
                  </span>
                </div>

                <p style={styles.text}>{p.text}</p>

                <div style={styles.actions}>
                  <button style={styles.likeBtn} onClick={() => toggleLike(p)}>
                    {liked ? "💔" : "❤️"} {(p.likes || []).length}
                  </button>

                  <button style={styles.reportBtn} onClick={() => reportPost(p)}>
                    🚨 Report
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 🎨 CLEAN UI STYLES
const styles = {
  page: {
    background: "#0f172a",
    minHeight: "100vh",
    color: "#fff",
    padding: 20,
    maxWidth: 600,
    margin: "0 auto"
  },
  title: {
    textAlign: "center",
    marginBottom: 20
  },
  card: {
    background: "#1e293b",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15
  },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "none",
    marginBottom: 10
  },
  button: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer"
  },
  header: {
    marginBottom: 8
  },
  username: {
    cursor: "pointer",
    fontWeight: "bold"
  },
  text: {
    marginBottom: 10
  },
  actions: {
    display: "flex",
    gap: 10
  },
  likeBtn: {
    background: "#334155",
    border: "none",
    padding: "6px 10px",
    borderRadius: 8,
    cursor: "pointer"
  },
  reportBtn: {
    background: "#7f1d1d",
    border: "none",
    padding: "6px 10px",
    borderRadius: 8,
    cursor: "pointer"
  },
  warning: {
    background: "#3f1d1d",
    padding: 10,
    borderRadius: 8
  },
  backBtn: {
    marginBottom: 10
  }
};

createRoot(document.getElementById("root")).render(<App />);
