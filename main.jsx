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

  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [chatText, setChatText] = useState("");

  const [notifications, setNotifications] = useState([]);
  const [popup, setPopup] = useState(null);

  const [users, setUsers] = useState([]);
  const [userData, setUserData] = useState(null);

  const [swipeQueue, setSwipeQueue] = useState([]);
  const [swipeAnim, setSwipeAnim] = useState("");

  useEffect(() => {
    async function init() {
      const res = await signInAnonymously(auth);
      setUser(res.user);

      const userRef = doc(db, "users", res.user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) setSavedUsername(snap.data().username);

      onSnapshot(userRef, s => s.exists() && setUserData(s.data()));

      onSnapshot(collection(db, "users"), snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setUsers(all);
        setSwipeQueue(all.filter(u => u.id !== res.user.uid));
      });

      onSnapshot(collection(db, "posts"), snap =>
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      );

      onSnapshot(collection(db, "messages"), snap =>
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      );

      onSnapshot(collection(db, "notifications"), snap => {
        const mine = snap.docs.map(d => d.data()).filter(n => n.toUser === res.user.uid);
        setNotifications(mine);
        if (mine.length) {
          setPopup(mine[mine.length - 1].text);
          setTimeout(() => setPopup(null), 3000);
        }
      });
    }
    init();
  }, []);

  async function createUserIfNeeded() {
    if (!user || !usernameInput) return;

    const refDoc = doc(db, "users", user.uid);
    const snap = await getDoc(refDoc);

    if (snap.exists()) return setSavedUsername(snap.data().username);

    const allUsers = await getDocs(collection(db, "users"));

    await setDoc(refDoc, {
      username: usernameInput,
      followers: [],
      following: [],
      isAdmin: allUsers.empty
    });

    setSavedUsername(usernameInput);
  }

  async function swipe(targetId, liked) {
    setSwipeAnim(liked ? "right" : "left");

    setTimeout(async () => {
      await addDoc(collection(db, "swipes"), {
        from: user.uid,
        to: targetId,
        liked,
        createdAt: Date.now()
      });

      setSwipeQueue(prev => prev.slice(1));
      setSwipeAnim("");
    }, 300);
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

  function getChatMessages(id) {
    return messages.filter(
      m =>
        (m.from === user.uid && m.to === id) ||
        (m.from === id && m.to === user.uid)
    );
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

          {/* SWIPE UI */}
          {tab === "swipe" && swipeQueue.length > 0 && (
            <div style={styles.swipeWrap}>
              <div
                style={{
                  ...styles.swipeCard,
                  transform:
                    swipeAnim === "left"
                      ? "translateX(-400px) rotate(-20deg)"
                      : swipeAnim === "right"
                      ? "translateX(400px) rotate(20deg)"
                      : "none"
                }}
              >
                <h2>@{swipeQueue[0].username}</h2>
              </div>

              <div style={styles.swipeBtns}>
                <button style={styles.dislike} onClick={() => swipe(swipeQueue[0].id, false)}>❌</button>
                <button style={styles.like} onClick={() => swipe(swipeQueue[0].id, true)}>💖</button>
              </div>
            </div>
          )}

          {/* CHAT */}
          {chatUser && (
            <div style={styles.chatBox}>
              {getChatMessages(chatUser.id).map(m => (
                <div
                  key={m.id}
                  style={
                    m.from === user.uid
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
                <button style={styles.sendBtn} onClick={sendMessage}>➤</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={styles.nav}>
        {[
          { id: "home", icon: "🏠" },
          { id: "swipe", icon: "🔥" },
          { id: "profile", icon: "👤" }
        ].map(t => (
          <button key={t.id} style={styles.navBtn} onClick={() => setTab(t.id)}>
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
    backgroundImage: "url('/background.jpg')",
    backgroundSize: "cover"
  },
  overlay: {
    minHeight: "100vh",
    backdropFilter: "blur(10px)",
    background: "rgba(0,0,0,0.6)"
  },
  container: { padding: 20 },

  swipeWrap: { textAlign: "center", marginTop: 50 },
  swipeCard: {
    width: 250,
    height: 300,
    margin: "auto",
    background: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    transition: "0.3s"
  },
  swipeBtns: { marginTop: 20, display: "flex", justifyContent: "center", gap: 20 },

  like: { fontSize: 30, background: "green", borderRadius: "50%" },
  dislike: { fontSize: 30, background: "red", borderRadius: "50%" },

  chatBox: { marginTop: 20 },
  myMsg: {
    background: "#6366f1",
    padding: 10,
    borderRadius: 15,
    margin: 5,
    alignSelf: "flex-end"
  },
  theirMsg: {
    background: "#1e293b",
    padding: 10,
    borderRadius: 15,
    margin: 5
  },

  chatInputWrap: { display: "flex", marginTop: 10 },
  chatInput: { flex: 1, padding: 10, borderRadius: 10 },
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
  navBtn: { fontSize: 24 },

  popup: {
    position: "fixed",
    bottom: 80,
    left: "50%",
    transform: "translateX(-50%)"
  }
};

createRoot(document.getElementById("root")).render(<App />);
