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
  orderBy,
  doc,
  setDoc,
  getDoc
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

      const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
      onSnapshot(q, (snapshot) => {
        setPosts(snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        })));
        setLoading(false);
      });
    }

    init();
  }, []);

  // ⭐ TRUST SYSTEM
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

  // 🚨 REPORT SYSTEM
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

    // increase trust for posting
    await updateTrust(user.uid, 1);

    setText("");
  }

  function profilePosts() {
    return posts.filter(p => p.userId === viewProfile.userId);
  }

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;

  // 🔥 PROFILE VIEW
  if (viewProfile) {
    return (
      <div style={{ padding: 20, background: "#0f172a", minHeight: "100vh", color: "#fff" }}>
        <button onClick={() => setViewProfile(null)}>← Back</button>

        <h2>@{viewProfile.username}</h2>

        {profilePosts().map(p => (
          <div key={p.id} style={{
            background: "#1e293b",
            padding: 15,
            borderRadius: 10,
            marginTop: 10
          }}>
            <p>{p.text}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      background: "#0f172a",
      minHeight: "100vh",
      color: "#fff",
      padding: 20
    }}>
      <h1>Kiaroni 🔥</h1>

      {!savedUsername ? (
        <div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose username"
          />
          <button onClick={saveUsername}>Save</button>
        </div>
      ) : (
        <p>@{savedUsername}</p>
      )}

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's happening?"
      />
      <button onClick={createPost}>Post</button>

      {posts.map(p => (
        <div key={p.id} style={{ marginTop: 20 }}>
          <strong
            style={{ cursor: "pointer" }}
            onClick={() =>
              setViewProfile({ userId: p.userId, username: p.username })
            }
          >
            @{p.username} ⭐ {p.trustScore || 50}
          </strong>

          <p>{p.text}</p>

          {/* 🚨 REPORT BUTTON */}
          <button onClick={() => reportPost(p)}>
            🚨 Report
          </button>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
