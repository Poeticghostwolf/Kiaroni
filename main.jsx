import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";

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
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const res = await signInAnonymously(auth);
        setUser(res.user);

        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        setPosts(snap.docs.map(d => d.data()));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  async function createPost() {
    if (!text) return;

    try {
      await addDoc(collection(db, "posts"), {
        text,
        userId: user.uid,
        createdAt: Date.now()
      });

      setText("");

      const snap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
      setPosts(snap.docs.map(d => d.data()));
    } catch (e) {
      alert("Post failed");
    }
  }

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>Kiaroni 🔥</h1>

      <div style={{ marginBottom: 20 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something..."
        />
        <button onClick={createPost}>Post</button>
      </div>

      <div>
        {posts.map((p, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <strong>{p.userId?.slice(0, 6)}</strong>
            <p>{p.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
