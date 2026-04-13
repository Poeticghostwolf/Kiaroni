import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  updateDoc
} from "firebase/firestore";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDLwujgVQGVc9I909EkAkaal3BLobQTSBw",
  authDomain: "kiaroni.firebaseapp.com",
  projectId: "kiaroni",
  storageBucket: "kiaroni.appspot.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

function App() {
  const [tab, setTab] = useState("home");
  const [feedMode, setFeedMode] = useState("foryou");

  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState(null);
  const [userData, setUserData] = useState(null);

  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);

  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);

  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [chatText, setChatText] = useState("");

  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [comments, setComments] = useState([]);
  const [commentInputs, setCommentInputs] = useState({});

  const [selectedProfile, setSelectedProfile] = useState(null);

  useEffect(() => {
    async function init() {
      const res = await signInAnonymously(auth);
      setUser(res.user);

      const userRef = doc(db, "users", res.user.uid);

      const snap = await getDoc(userRef);
      if (snap.exists()) setSavedUsername(snap.data().username);

      onSnapshot(userRef, s => {
        if (s.exists()) {
          setUserData(s.data());
          setBio(s.data().bio || "");
        }
      });

      onSnapshot(collection(db, "users"), snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      onSnapshot(collection(db, "posts"), snap => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      // ✅ FIXED MESSAGES
      onSnapshot(collection(db, "messages"), snap => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMessages(msgs);
      });

      onSnapshot(collection(db, "notifications"), snap => {
        const data = snap.docs.map(d => d.data());
        setNotifications(data.filter(n => n.toUser === res.user.uid));
      });

      onSnapshot(collection(db, "comments"), snap => {
        setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    init();
  }, []);

  // ✅ CHAT FILTER
  function getChatMessages() {
    if (!chatUser || !user) return [];

    return messages
      .filter(
        m =>
          (m.from === user.uid && m.to === chatUser.id) ||
          (m.from === chatUser.id && m.to === user.uid)
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  // ✅ SEND MESSAGE
  async function sendMessage() {
    if (!chatText.trim() || !chatUser) return;

    await addDoc(collection(db, "messages"), {
      text: chatText,
      from: user.uid,
      to: chatUser.id,
      createdAt: Date.now()
    });

    setChatText("");

    await addDoc(collection(db, "notifications"), {
      text: `${savedUsername} sent you a message`,
      toUser: chatUser.id,
      createdAt: Date.now()
    });
  }

  function getTrendingPosts() {
    return [...posts]
      .map(p => {
        const likes = (p.likes || []).length;
        const age = Date.now() - p.createdAt;
        const recencyBoost = age < 3600000 ? 20 : 0;
        return { ...p, score: likes * 10 + recencyBoost };
      })
      .sort((a, b) => b.score - a.score);
  }

  async function createPost() {
    if (!text && !file) return;

    const imageUrl = file
      ? await (async () => {
          const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          return await getDownloadURL(storageRef);
        })()
      : "";

    await addDoc(collection(db, "posts"), {
      text,
      image: imageUrl,
      userId: user.uid,
      username: savedUsername,
      likes: [],
      createdAt: Date.now()
    });

    setText("");
    setFile(null);
  }

  // ✅ SAFE LIKE
  async function toggleLike(post) {
    if (!user) return;

    const refDoc = doc(db, "posts", post.id);
    const likes = post.likes || [];

    const isLiked = likes.includes(user.uid);

    const updated = isLiked
      ? likes.filter(id => id !== user.uid)
      : [...likes, user.uid];

    await updateDoc(refDoc, { likes: updated });

    if (!isLiked && post.userId !== user.uid) {
      await addDoc(collection(db, "notifications"), {
        text: `${savedUsername} liked your post`,
        toUser: post.userId,
        createdAt: Date.now()
      });
    }
  }

  return (
    <div style={styles.app}>
      <div style={styles.container}>
        <h1>Kiaroni 🔥</h1>

        {!savedUsername && (
          <>
            <input value={username} onChange={e => setUsername(e.target.value)} />
            <button onClick={async () => {
              if (!username) return;
              await setDoc(doc(db, "users", user.uid), {
                username,
                bio: "",
                avatar: "",
                followers: [],
                following: []
              });
              setSavedUsername(username);
            }}>Save</button>
          </>
        )}

        {/* FEED */}
        {tab === "home" && (
          <>
            <input value={text} onChange={e => setText(e.target.value)} />
            <input type="file" onChange={e => setFile(e.target.files[0])} />
            <button onClick={createPost}>Post</button>

            {getTrendingPosts().map(p => (
              <div key={p.id} style={styles.card}>
                <strong>@{p.username}</strong>
                <p>{p.text}</p>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => toggleLike(p)}>
                    {(p.likes || []).includes(user?.uid) ? "💖" : "🤍"} {(p.likes || []).length}
                  </button>

                  <button onClick={() => setChatUser({ id: p.userId, username: p.username })}>
                    💬
                  </button>

                  <button onClick={async () => {
                    await addDoc(collection(db, "reports"), {
                      postId: p.id,
                      reportedUser: p.userId,
                      reportedBy: user.uid,
                      text: p.text,
                      createdAt: Date.now()
                    });
                    alert("Reported");
                  }}>
                    🚨
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ✅ CHAT UI */}
      {chatUser && (
        <div style={styles.chatBox}>
          <h4>@{chatUser.username}</h4>

          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {getChatMessages().map(m => (
              <div key={m.id}>
                <b>{m.from === user.uid ? "Me" : chatUser.username}:</b> {m.text}
              </div>
            ))}
          </div>

          <input
            value={chatText}
            onChange={e => setChatText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
          />
          <button onClick={sendMessage}>Send</button>
          <button onClick={() => setChatUser(null)}>Close</button>
        </div>
      )}

      <div style={styles.nav}>
        <button onClick={() => setTab("home")}>🏠</button>
      </div>
    </div>
  );
}

const styles = {
  app: { background: "#0f172a", minHeight: "100vh", color: "#fff" },
  container: { maxWidth: 500, margin: "auto", padding: 20 },
  card: { background: "#1e293b", padding: 10, marginTop: 10, borderRadius: 10 },
  nav: {
    position: "fixed",
    bottom: 0,
    width: "100%",
    display: "flex",
    justifyContent: "space-around",
    background: "#1e293b",
    padding: 10
  },
  chatBox: {
    position: "fixed",
    bottom: 60,
    right: 20,
    width: 300,
    background: "#1e293b",
    padding: 10,
    borderRadius: 10
  }
};

createRoot(document.getElementById("root")).render(<App />);
