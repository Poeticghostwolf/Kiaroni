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
  updateDoc,
  query,
  where,
  getDocs
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

  const [user, setUser] = useState(null);
  const [savedUsername, setSavedUsername] = useState(null);
  const [usernameInput, setUsernameInput] = useState("");

  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [chatText, setChatText] = useState("");

  const [notifications, setNotifications] = useState([]);
  const [popup, setPopup] = useState(null);

  const [users, setUsers] = useState([]);
  const [userData, setUserData] = useState(null);

  const [reports, setReports] = useState([]);
  const [swipeQueue, setSwipeQueue] = useState([]);

  useEffect(() => {
    async function init() {
      const res = await signInAnonymously(auth);
      setUser(res.user);

      const userRef = doc(db, "users", res.user.uid);

      const snap = await getDoc(userRef);
      if (snap.exists()) setSavedUsername(snap.data().username);

      onSnapshot(userRef, s => {
        if (s.exists()) setUserData(s.data());
      });

      onSnapshot(collection(db, "users"), snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setUsers(all);
        setSwipeQueue(all.filter(u => u.id !== res.user.uid));
      });

      onSnapshot(collection(db, "posts"), snap => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      onSnapshot(collection(db, "messages"), snap => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      onSnapshot(collection(db, "notifications"), snap => {
        const data = snap.docs.map(d => d.data());
        const mine = data.filter(n => n.toUser === res.user.uid);
        setNotifications(mine);

        if (mine.length) {
          setPopup(mine[mine.length - 1].text);
          setTimeout(() => setPopup(null), 3000);
        }
      });

      onSnapshot(collection(db, "reports"), snap => {
        setReports(snap.docs.map(d => d.data()));
      });
    }

    init();
  }, []);

  function getSmartFeed() {
    return [...posts]
      .map(p => {
        const likes = (p.likes || []).length;
        const age = Date.now() - p.createdAt;
        const recencyBoost = age < 3600000 ? 20 : 0;
        return { ...p, score: likes * 10 + recencyBoost };
      })
      .sort((a, b) => b.score - a.score);
  }

  async function createUserIfNeeded() {
    if (!user || !usernameInput) return;

    const refDoc = doc(db, "users", user.uid);
    const snap = await getDoc(refDoc);

    if (snap.exists()) {
      setSavedUsername(snap.data().username);
      return;
    }

    const allUsersSnap = await getDocs(collection(db, "users"));
    const isFirstUser = allUsersSnap.empty;

    await setDoc(refDoc, {
      username: usernameInput,
      followers: [],
      following: [],
      isAdmin: isFirstUser
    });

    setSavedUsername(usernameInput);

    if (isFirstUser) {
      alert("🔥 You are the first user — Admin granted!");
    }
  }

  async function createPost() {
    let imageUrl = "";

    if (file) {
      const r = ref(storage, `posts/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      imageUrl = await getDownloadURL(r);
    }

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
    setPreview(null);
  }

  async function toggleLike(post) {
    const refDoc = doc(db, "posts", post.id);
    const likes = post.likes || [];

    await updateDoc(refDoc, {
      likes: likes.includes(user.uid)
        ? likes.filter(id => id !== user.uid)
        : [...likes, user.uid]
    });
  }

  async function swipe(targetId, liked) {
    await addDoc(collection(db, "swipes"), {
      from: user.uid,
      to: targetId,
      liked,
      createdAt: Date.now()
    });

    if (liked) {
      const q = query(
        collection(db, "swipes"),
        where("from", "==", targetId),
        where("to", "==", user.uid),
        where("liked", "==", true)
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        await addDoc(collection(db, "matches"), {
          users: [user.uid, targetId],
          createdAt: Date.now()
        });

        await addDoc(collection(db, "notifications"), {
          text: "🔥 It's a match!",
          toUser: targetId,
          createdAt: Date.now()
        });
      }
    }

    setSwipeQueue(prev => prev.slice(1));
  }

  async function sendMessage() {
    if (!chatText || !chatUser) return;

    await addDoc(collection(db, "messages"), {
      text: chatText,
      from: user.uid,
      to: chatUser.id,
      createdAt: Date.now()
    });

    setChatText("");
  }

  return (
    <div style={styles.app}>
      <div style={styles.overlay}>
        <div style={styles.container}>
          <h1>Kiaroni 🔥</h1>

          {popup && <div style={styles.popup}>{popup}</div>}

          {!savedUsername && (
            <>
              <input
                style={styles.input}
                placeholder="Username"
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
              />
              <button style={styles.button} onClick={createUserIfNeeded}>
                Continue
              </button>
            </>
          )}

          {tab === "home" &&
            getSmartFeed().map(p => (
              <div key={p.id} style={styles.card}>
                <b>@{p.username}</b>
                <p>{p.text}</p>
                <button style={styles.button} onClick={() => toggleLike(p)}>
                  ❤️ {(p.likes || []).length}
                </button>
                <button style={styles.button} onClick={() => setChatUser({ id: p.userId })}>
                  💬
                </button>
              </div>
            ))}

          {tab === "swipe" && swipeQueue.length > 0 && (
            <div style={styles.card}>
              <h2>@{swipeQueue[0].username}</h2>
              <button style={styles.button} onClick={() => swipe(swipeQueue[0].id, false)}>❌</button>
              <button style={styles.button} onClick={() => swipe(swipeQueue[0].id, true)}>💖</button>
            </div>
          )}

          {tab === "admin" && userData?.isAdmin && (
            <div style={styles.card}>
              <h2>Admin Panel</h2>
              {reports.map((r, i) => (
                <div key={i}>
                  <p>{r.postId}</p>
                  <p>{r.reportedUser}</p>
                </div>
              ))}
            </div>
          )}

          {chatUser && (
            <div style={styles.card}>
              {messages.map(m => (
                <div key={m.id}>{m.text}</div>
              ))}
              <input
                style={styles.input}
                value={chatText}
                onChange={e => setChatText(e.target.value)}
              />
              <button style={styles.button} onClick={sendMessage}>
                Send
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={styles.nav}>
        {[
          { id: "home", icon: "🏠" },
          { id: "swipe", icon: "🔥" },
          { id: "profile", icon: "👤" },
          ...(userData?.isAdmin ? [{ id: "admin", icon: "🛡" }] : [])
        ].map(t => (
          <button
            key={t.id}
            style={styles.navBtn}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    color: "#fff",
    backgroundImage: "url('/background.jpg')",
    backgroundSize: "cover",
    backgroundPosition: "center"
  },
  overlay: {
    minHeight: "100vh",
    background: "rgba(15,23,42,0.75)",
    backdropFilter: "blur(10px)"
  },
  container: {
    maxWidth: 500,
    margin: "auto",
    padding: 20
  },
  card: {
    background: "rgba(30,41,59,0.6)",
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    padding: 15,
    marginTop: 10
  },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "none",
    marginTop: 10
  },
  button: {
    marginTop: 10,
    padding: "10px 15px",
    borderRadius: 10,
    border: "none",
    background: "#6366f1",
    color: "#fff"
  },
  nav: {
    position: "fixed",
    bottom: 0,
    width: "100%",
    display: "flex",
    justifyContent: "space-around",
    background: "rgba(30,41,59,0.7)"
  },
  navBtn: {
    background: "none",
    border: "none",
    fontSize: 22,
    color: "#fff"
  },
  popup: {
    position: "fixed",
    bottom: 80,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#6366f1",
    padding: "10px 20px",
    borderRadius: 20
  }
};

createRoot(document.getElementById("root")).render(<App />);
