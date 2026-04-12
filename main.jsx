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

  const [follows, setFollows] = useState([]);

  useEffect(() => {
    async function init() {
      const res = await signInAnonymously(auth);
      setUser(res.user);

      const userRef = doc(db, "users", res.user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setSavedUsername(userSnap.data().username);
      }

      const postSnap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
      setPosts(postSnap.docs.map(d => d.data()));

      const followSnap = await getDocs(collection(db, "follows"));
      setFollows(followSnap.docs.map(d => d.data()));

      setLoading(false);
    }

    init();
  }, []);

  async function saveUsername() {
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

  async function followUser(targetId) {
    await addDoc(collection(db, "follows"), {
      followerId: user.uid,
      followingId: targetId
    });

    const snap = await getDocs(collection(db, "follows"));
    setFollows(snap.docs.map(d => d.data()));
  }

  function isFollowing(targetId) {
    return follows.some(
      f => f.followerId === user.uid && f.followingId === targetId
    );
  }

  function filteredPosts() {
    const followingIds = follows
      .filter(f => f.followerId === user.uid)
      .map(f => f.followingId);

    return posts.filter(
      p => p.userId === user.uid || followingIds.includes(p.userId)
    );
  }

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
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
        placeholder="Post..."
      />
      <button onClick={createPost}>Post</button>

      <h3>Feed</h3>

      {filteredPosts().map((p, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <strong>@{p.username}</strong>
          <p>{p.text}</p>

          {p.userId !== user.uid && !isFollowing(p.userId) && (
            <button onClick={() => followUser(p.userId)}>Follow</button>
          )}
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
