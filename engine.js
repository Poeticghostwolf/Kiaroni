// =============================================
// KIARONI V11 FULL CODE PACK (SINGLE FILE)
// =============================================

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, useParams } from "react-router-dom";

import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  increment,
  where,
  setDoc,
  getDoc
} from "firebase/firestore";

// =============================================
// 🔥 FIREBASE CONFIG (REPLACE THESE)
// =============================================
const firebaseConfig = {
  apiKey: "AIzaSyDLwujgVQGVc9I909EkAkaal3BLobQTSBw",
  authDomain: "kiaroni.firebaseapp.com",
  projectId: "kiaroni"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =============================================
// 🔒 RATE LIMIT
// =============================================
let lastLikeTime = 0;

// =============================================
// 🧠 UTILS
// =============================================
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h";
  return Math.floor(hrs / 24) + "d";
}

// =============================================
// 🚀 APP ROOT
// =============================================
function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (u) {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          await setDoc(ref, {
            username: "user_" + u.uid.slice(0, 5),
            trustScore: 0,
            createdAt: Date.now()
          });
        }
      }
    });
  }, []);

  if (!user) return <Landing />;

  return (
    <BrowserRouter>
      <div style={layout}>
        <Sidebar />
        <main style={main}>
          <Routes>
            <Route path="/" element={<Feed user={user} />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/notifications" element={<Notifications user={user} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

// =============================================
// 🌐 LANDING
// =============================================
function Landing() {
  return (
    <div style={landing}>
      <h1>Social, but real.</h1>
      <p>Trust-first social platform</p>
      <Auth />
    </div>
  );
}

// =============================================
// 📱 SIDEBAR
// =============================================
function Sidebar() {
  return (
    <div style={sidebar}>
      <h2>Kiaroni</h2>
      <Link to="/">Home</Link><br />
      <Link to="/notifications">Notifications</Link>
    </div>
  );
}

// =============================================
// 📰 FEED
// =============================================
function Feed({ user }) {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

    return onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
      setPosts(data);
    });
  }, []);

  return (
    <div>
      <CreatePost user={user} />
      {posts.map((p) => (
        <Post key={p.id} post={p} currentUser={user} />
      ))}
    </div>
  );
}

// =============================================
// ✍️ CREATE POST
// =============================================
function CreatePost({ user }) {
  const [text, setText] = useState("");

  async function create() {
    if (!text) return;

    await addDoc(collection(db, "posts"), {
      text,
      userId: user.uid,
      createdAt: Date.now(),
      likes: 0
    });

    setText("");
  }

  return (
    <div style={card}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={input}
        placeholder="What's happening?"
      />
      <button style={button} onClick={create}>Post</button>
    </div>
  );
}

// =============================================
// 🧾 POST
// =============================================
function Post({ post, currentUser }) {

  async function likePost() {
    if (Date.now() - lastLikeTime < 2000) return;
    lastLikeTime = Date.now();

    await updateDoc(doc(db, "posts", post.id), {
      likes: increment(1)
    });

    if (post.userId !== currentUser.uid) {
      await addDoc(collection(db, "notifications"), {
        userId: post.userId,
        type: "like",
        createdAt: Date.now()
      });
    }
  }

  async function reportPost() {
    await addDoc(collection(db, "reports"), {
      reportedId: post.id,
      reporterId: currentUser.uid,
      createdAt: Date.now()
    });

    alert("Reported");
  }

  return (
    <div style={card}>
      <p>{post.text}</p>
      <small>{timeAgo(post.createdAt)}</small>
      <br />
      <button style={actionBtn} onClick={likePost}>
        ❤️ {post.likes || 0}
      </button>
      <button style={actionBtn} onClick={reportPost}>
        🚩
      </button>
    </div>
  );
}

// =============================================
// 👤 PROFILE
// =============================================
function Profile() {
  const { id } = useParams();
  const [user, setUser] = useState(null);

  useEffect(() => {
    getDoc(doc(db, "users", id)).then((s) => {
      if (s.exists()) setUser(s.data());
    });
  }, [id]);

  if (!user) return null;

  return (
    <div style={card}>
      <h3>{user.username}</h3>
      <p>Trust Score: {user.trustScore}</p>
    </div>
  );
}

// =============================================
// 🔔 NOTIFICATIONS
// =============================================
function Notifications({ user }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
      setItems(data);
    });
  }, []);

  return items.map((n) => (
    <div key={n.id} style={card}>
      <p>
        {n.type === "like"
          ? "❤️ Someone liked your post"
          : "New activity"}
      </p>
      <small>{timeAgo(n.createdAt)}</small>
    </div>
  ));
}

// =============================================
// 🔐 AUTH
// =============================================
function Auth() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  return (
    <div>
      <input
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
        style={input}
      />
      <input
        type="password"
        placeholder="Password"
        onChange={(e) => setPass(e.target.value)}
        style={input}
      />
      <button
        style={button}
        onClick={() => signInWithEmailAndPassword(auth, email, pass)}
      >
        Login
      </button>
      <button
        style={button}
        onClick={() => createUserWithEmailAndPassword(auth, email, pass)}
      >
        Register
      </button>
    </div>
  );
}

// =============================================
// 🎨 UI STYLES
// =============================================
const layout = {
  display: "flex",
  background: "#0F172A",
  color: "#fff",
  minHeight: "100vh"
};

const main = {
  flex: 1,
  maxWidth: 600,
  margin: "0 auto",
  padding: 20
};

const sidebar = {
  width: 200,
  padding: 20
};

const landing = {
  textAlign: "center",
  padding: 80
};

const card = {
  background: "#1E293B",
  padding: 15,
  borderRadius: 12,
  marginBottom: 15
};

const input = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  marginBottom: 10
};

const button = {
  background: "#6366F1",
  color: "#fff",
  padding: "8px 12px",
  border: "none",
  borderRadius: 8
};

const actionBtn = {
  marginRight: 10
};

// =============================================
// 🚀 RENDER
// =============================================


// =============================================
// ✅ KIARONI V11 COMPLETE
// =============================================