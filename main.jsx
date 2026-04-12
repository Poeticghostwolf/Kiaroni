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
      try {
        const res = await signInAnonymously(auth);
        setUser(res.user);

        // 🔥 check if user has username
        const userRef = doc(db, "users", res.user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setSavedUsername(userSnap.data().username);
        }

        // load posts
        const snap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
        setPosts(snap.docs.map(d => d.data()));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
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

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>Kiaroni 🔥</h1>

      {!savedUsername ? (
        <div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
          />
          <button onClick={saveUsername}>Save</button>
        </div>
      ) : (
        <p>Welcome @{savedUsername}</p>
      )}

      <div style={{ marginTop: 20 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something..."
        />
        <button onClick={createPost}>Post</button>
      </div>

      <div style={{ marginTop: 20 }}>
        {posts.map((p, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <strong>@{p.username || "anon"}</strong>
            <p>{p.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
