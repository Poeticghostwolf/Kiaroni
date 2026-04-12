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

  const [comments, setComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});

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

  function listenComments(postId) {
    const q = query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc")
    );

    onSnapshot(q, (snapshot) => {
      setComments(prev => ({
        ...prev,
        [postId]: snapshot.docs.map(d => d.data())
      }));
    });
  }

  async function addComment(postId) {
    const text = commentInputs[postId];
    if (!text) return;

    await addDoc(collection(db, "posts", postId, "comments"), {
      text,
      username: savedUsername,
      createdAt: Date.now()
    });

    setCommentInputs(prev => ({ ...prev, [postId]: "" }));
  }

  if (loading) return <p style={{ padding: 20, color: "#fff" }}>Loading...</p>;

  return (
    <div style={{
      background: "#0f172a",
      minHeight: "100vh",
      color: "#fff",
      fontFamily: "system-ui",
      display: "flex",
      justifyContent: "center"
    }}>
      <div style={{ width: "100%", maxWidth: 500, padding: 20 }}>

        <h1 style={{ marginBottom: 20 }}>Kiaroni 🔥</h1>

        {!savedUsername ? (
          <div style={{
            background: "#1e293b",
            padding: 15,
            borderRadius: 12,
            marginBottom: 20
          }}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose username"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "none",
                marginBottom: 10
              }}
            />
            <button style={{ width: "100%" }} onClick={saveUsername}>
              Continue
            </button>
          </div>
        ) : (
          <p style={{ marginBottom: 20, opacity: 0.7 }}>
            Logged in as @{savedUsername}
          </p>
        )}

        <div style={{
          background: "#1e293b",
          padding: 15,
          borderRadius: 12,
          marginBottom: 20
        }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening?"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "none",
              marginBottom: 10
            }}
          />
          <button style={{ width: "100%" }} onClick={createPost}>
            Post
          </button>
        </div>

        {posts.map(p => (
          <div key={p.id} style={{
            background: "#1e293b",
            padding: 15,
            borderRadius: 12,
            marginBottom: 15
          }}>
            <strong>@{p.username}</strong>
            <p style={{ marginTop: 5 }}>{p.text}</p>

            <button onClick={() => toggleLike(p)}>
              ❤️ {p.likes?.length || 0}
            </button>

            <div style={{ marginTop: 10 }}>
              <input
                value={commentInputs[p.id] || ""}
                onChange={(e) =>
                  setCommentInputs(prev => ({
                    ...prev,
                    [p.id]: e.target.value
                  }))
                }
                placeholder="Write a comment..."
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "none",
                  marginBottom: 5
                }}
              />
              <button onClick={() => {
                addComment(p.id);
                listenComments(p.id);
              }}>
                Comment
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              {(comments[p.id] || []).map((c, i) => (
                <p key={i} style={{ fontSize: 14 }}>
                  <strong>@{c.username}</strong>: {c.text}
                </p>
              ))}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
