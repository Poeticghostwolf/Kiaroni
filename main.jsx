import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";

// 🔥 Replace with YOUR values
const firebaseConfig = {
  aapiKey: "AIzaSyDLwujgVQGVc9I909EkAkaal3BLobQTSBw",
  authDomain: "kiaroni.firebaseapp.com",
  projectId: "kiaroni"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function App() {
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        await signInAnonymously(auth);

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
        createdAt: Date.now()
      });

      setText("");

      // reload posts
      const snap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
      setPosts(snap.docs.map(d => d.data()));
    } catch (e) {
      alert("Post failed – check Firebase setup");
    }
  }

  if (loading) return <p style={{padding:20}}>Loading...</p>;

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
            <strong>User</strong>
            <p>{p.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
