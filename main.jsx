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
  const [tab, setTab] = useState("swipe");

  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);

  const [usernameInput, setUsernameInput] = useState("");
  const [savedUsername, setSavedUsername] = useState(null);

  const [users, setUsers] = useState([]);
  const [swipeQueue, setSwipeQueue] = useState([]);

  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [chatText, setChatText] = useState("");

  const [popup, setPopup] = useState(null);

  // 🔐 INIT
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
    }

    init();
  }, []);

  // 💬 LOAD CHAT (filtered)
  useEffect(() => {
    if (!user || !chatUser) return;

    const q = query(
      collection(db, "messages"),
      where("participants", "array-contains", user.uid)
    );

    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = data.filter(m =>
        m.participants.includes(chatUser.id)
      );
      setMessages(filtered.sort((a, b) => a.createdAt - b.createdAt));
    });

    return () => unsub();
  }, [user, chatUser]);

  // 👤 CREATE USER + AUTO ADMIN
  async function createUserIfNeeded() {
    if (!user || !usernameInput) return;

    const refDoc = doc(db, "users", user.uid);
    const snap = await getDoc(refDoc);

    if (snap.exists()) {
      setSavedUsername(snap.data().username);
      return;
    }

    const allUsers = await getDocs(collection(db, "users"));

    await setDoc(refDoc, {
      username: usernameInput,
      followers: [],
      following: [],
      isAdmin: allUsers.empty
    });

    setSavedUsername(usernameInput);
  }

  // 🔥 SWIPE
  async function swipe(targetId, liked) {
    if (!user) return;

    await addDoc(collection(db, "swipes"), {
      from: user.uid,
      to: targetId,
      liked,
      createdAt: Date.now()
    });

    setSwipeQueue(prev => prev.slice(1));
  }

  // 💬 SEND MESSAGE
  async function sendMessage() {
    if (!chatText || !chatUser || !user) return;

    await addDoc(collection(db, "messages"), {
      text: chatText,
      participants: [user.uid, chatUser.id],
      createdAt: Date.now()
    });

    setChatText("");
  }

  return (
    <div style={styles.app}>
      <div style={styles.overlay}>
        <div style={styles.container}>
          <h1>Kiaroni 🔥</h1>

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

          {/* 🔥 SWIPE */}
          {tab === "swipe" && swipeQueue.length > 0 && (
            <div style={styles.swipeCard}>
              <h2>@{swipeQueue[0].username}</h2>

              <div style={{ marginTop: 20 }}>
                <button style={styles.dislike} onClick={() => swipe(swipeQueue[0].id, false)}>❌</button>
                <button style={styles.like} onClick={() => swipe(swipeQueue[0].id, true)}>💖</button>
              </div>

              <button
                style={styles.button}
                onClick={() => setChatUser(swipeQueue[0])}
              >
                Message
              </button>
            </div>
          )}

          {/* 💬 CHAT */}
          {chatUser && (
            <div style={styles.chatBox}>
              {messages.map(m => (
                <div
                  key={m.id}
                  style={
                    m.participants[0] === user.uid
                      ? styles.myMsg
                      : styles.theirMsg
                  }
                >
                  {m.text}
                </div>
              ))}

              <div style={styles.chatInputWrap}>
                <input
                  style={styles.chatInput}
                  value={chatText}
                  onChange={e => setChatText(e.target.value)}
                />
                <button style={styles.sendBtn} onClick={sendMessage}>
                  ➤
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NAV */}
      <div style={styles.nav}>
        {["swipe", "profile"].map(t => (
          <button key={t} style={styles.navBtn} onClick={() => setTab(t)}>
            {t === "swipe" ? "🔥" : "👤"}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    backgroundImage: "url('/background.jpg')",
    backgroundSize: "cover"
  },
  overlay: {
    minHeight: "100vh",
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(10px)"
  },
  container: { padding: 20 },

  swipeCard: {
    background: "rgba(255,255,255,0.1)",
    padding: 20,
    borderRadius: 20,
    textAlign: "center"
  },

  like: { fontSize: 30, margin: 10 },
  dislike: { fontSize: 30, margin: 10 },

  chatBox: { marginTop: 20 },

  myMsg: {
    background: "#6366f1",
    padding: 10,
    borderRadius: 15,
    margin: 5,
    textAlign: "right"
  },

  theirMsg: {
    background: "#1e293b",
    padding: 10,
    borderRadius: 15,
    margin: 5
  },

  chatInputWrap: { display: "flex", marginTop: 10 },
  chatInput: { flex: 1, padding: 10 },
  sendBtn: { padding: 10 },

  input: { padding: 10, width: "100%" },
  button: { padding: 10, marginTop: 10 },

  nav: {
    position: "fixed",
    bottom: 0,
    width: "100%",
    display: "flex",
    justifyContent: "space-around"
  },
  navBtn: { fontSize: 24 }
};

createRoot(document.getElementById("root")).render(<App />);
