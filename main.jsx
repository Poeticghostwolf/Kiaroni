import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
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

      const snap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
      setPosts(snap.docs.map(d => d.data()));

      setLoading(false);
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
      createdAt: Date.now()
    });

    setText("");

    const snap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
    setPosts(snap.docs.map(d => d.data()));
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
      <h1 style={{ marginBottom: 20 }}>Kiaroni 🔥</h1>

      {!savedUsername ? (
        <div style={{
          background: "#1e293b",
          padding: 15,
          borderRadius: 10,
          marginBottom: 20
        }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose username"
            style={{
              padding: 10,
              borderRadius: 6,
              border: "none",
              marginRight: 10
            }}
          />
          <button onClick={saveUsername}>Save</button>
        </div>
      ) : (
        <p style={{ marginBottom: 20 }}>@{savedUsername}</p>
      )}

      <div style={{
        background: "#1e293b",
        padding: 15,
        borderRadius: 10,
        marginBottom: 20
      }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's happening?"
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 6,
            border: "none",
            marginBottom: 10
          }}
        />
        <button onClick={createPost}>Post</button>
      </div>

      <div>
        {posts.map((p, i) => (
          <div key={i} style={{
            background: "#1e293b",
            padding: 15,
            borderRadius: 10,
            marginBottom: 15
          }}>
            <div style={{ fontWeight: "bold", marginBottom: 5 }}>
              @{p.username || "anon"}
            </div>
            <div>{p.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
