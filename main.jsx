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

  useEffect(() => {
    async function init() {
      const res = await signInAnonymously(auth);
      setUser(res.user);

      const userRef = doc(db, "users", res.user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setSavedUsername(userSnap.data().username);
      }

      // ⚡ REAL-TIME POSTS
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

  async function saveUsername() {
    if (!username) return;

    await setDoc(doc(db, "users", user.uid), { username });
    setSavedUsername(username);
  }

  async function createPost() {
    if (!text) return;

    await addDoc(collection(db, "posts"), {
      text,
      userId: user.uid,
      username: savedUsername,
      likes: [],
      createdAt: Date.now()
    });

    setText("");
  }

  async function toggleLike(post) {
    const ref = doc(db, "posts", post.id);

    let updatedLikes;

    if (post.likes?.includes(user.uid)) {
      updatedLikes = post.likes.filter(id => id !== user.uid);
    } else {
      updatedLikes = [...(post.likes || []), user.uid];
    }

    await setDoc(ref, { ...post, likes: updatedLikes });
  }

  if (loading) return <p style={{ padding: 20, color: "#fff", background: "#0f172a" }}>Loading...</p>;

  return (
    <div style={{
      background: "#0f172a",
      minHeight: "100vh",
      color: "#fff",
      fontFamily: "system-ui",
      padding: "20px"
    }}>
      <h1>Kiaroni 🔥</h1>

      {!savedUsername ? (
        <div style={{ background: "#1e293b", padding: 15, borderRadius: 10 }}>
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

      <div style={{ marginTop: 20 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's happening?"
        />
        <button onClick={createPost}>Post</button>
      </div>

      <div style={{ marginTop: 20 }}>
        {posts.map((p) => (
          <div key={p.id} style={{
            background: "#1e293b",
            padding: 15,
            borderRadius: 10,
            marginBottom: 15
          }}>
            <strong>@{p.username || "anon"}</strong>
            <p>{p.text}</p>

            <button onClick={() => toggleLike(p)}>
              ❤️ {p.likes?.length || 0}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
