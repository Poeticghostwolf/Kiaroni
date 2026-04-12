import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

// 🔥 YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDLwujgVQGVc9I909EkAkaal3BLobQTSBw",
  authDomain: "kiaroni.firebaseapp.com",
  projectId: "kiaroni"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function App() {
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    signInAnonymously(auth);

    async function loadPosts() {
      const snap = await getDocs(collection(db, "posts"));
      setPosts(snap.docs.map(d => d.data()));
    }

    loadPosts();
  }, []);

  async function createPost() {
    if (!text) return;

    await addDoc(collection(db, "posts"), {
      text,
      createdAt: Date.now()
    });

    setText("");
    window.location.reload();
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Kiaroni 🔥</h1>

      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Say something..."
      />
      <button onClick={createPost}>Post</button>

      <div>
        {posts.map((p, i) => (
          <p key={i}>{p.text}</p>
        ))}
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
