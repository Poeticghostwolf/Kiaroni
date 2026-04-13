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

  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);

  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [chatText, setChatText] = useState("");

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  const [notifications, setNotifications] = useState([]);

  const [selectedProfile, setSelectedProfile] = useState(null);

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
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      onSnapshot(collection(db, "posts"), snap => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      onSnapshot(collection(db, "messages"), snap => {
        setMessages(snap.docs.map(d => d.data()));
      });

      onSnapshot(collection(db, "notifications"), snap => {
        const data = snap.docs.map(d => d.data());
        setNotifications(data.filter(n => n.toUser === res.user.uid));
      });
    }

    init();
  }, []);

  // 🔥 FOR YOU FEED
  function getTrendingPosts() {
    return [...posts]
      .map(p => {
        const likes = (p.likes || []).length;
        const age = Date.now() - p.createdAt;
        const recencyBoost = age < 3600000 ? 20 : 0;
        const randomBoost = Math.random() * 5;

        const score = likes * 10 + recencyBoost + randomBoost;
        return { ...p, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  // 👥 FOLLOWING FEED
  function getFollowingPosts() {
    if (!userData?.following) return [];

    return posts
      .filter(p => userData.following.includes(p.userId))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async function saveUsername() {
    if (!username) return;

    await setDoc(doc(db, "users", user.uid), {
      username,
      followers: [],
      following: []
    });

    setSavedUsername(username);
  }

  async function toggleFollow(targetId) {
    const myRef = doc(db, "users", user.uid);
    const theirRef = doc(db, "users", targetId);

    const mySnap = await getDoc(myRef);
    const theirSnap = await getDoc(theirRef);

    const myData = mySnap.data() || {};
    const theirData = theirSnap.data() || {};

    const following = myData.following || [];
    const followers = theirData.followers || [];

    const isFollowing = following.includes(targetId);

    if (isFollowing) {
      await updateDoc(myRef, {
        following: following.filter(id => id !== targetId)
      });

      await updateDoc(theirRef, {
        followers: followers.filter(id => id !== user.uid)
      });
    } else {
      await updateDoc(myRef, {
        following: [...following, targetId]
      });

      await updateDoc(theirRef, {
        followers: [...followers, user.uid]
      });
    }
  }

  async function uploadImage(file) {
    if (!file) return null;
    const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }

  async function createPost() {
    if (!text && !file) return;

    const imageUrl = await uploadImage(file);

    await addDoc(collection(db, "posts"), {
      text,
      image: imageUrl || "",
      userId: user.uid,
      username: savedUsername,
      likes: [],
      createdAt: Date.now()
    });

    setText("");
    setFile(null);
  }

  async function toggleLike(post) {
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

  async function sendMessage() {
    if (!chatText || !chatUser) return;

    await addDoc(collection(db, "messages"), {
      text: chatText,
      from: user.uid,
      to: chatUser.id,
      username: savedUsername,
      createdAt: Date.now()
    });

    await addDoc(collection(db, "notifications"), {
      text: `${savedUsername} sent you a message`,
      toUser: chatUser.id,
      createdAt: Date.now()
    });

    setChatText("");
  }

  function userPosts(userId) {
    return posts.filter(p => p.userId === userId);
  }

  return (
    <div style={styles.app}>
      <div style={styles.container}>
        <h1>Kiaroni 🔥</h1>

        {!savedUsername && (
          <>
            <input value={username} onChange={e => setUsername(e.target.value)} />
            <button onClick={saveUsername}>Save</button>
          </>
        )}

        {/* HOME */}
        {tab === "home" && !selectedProfile && (
          <>
            {/* FEED TOGGLE */}
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <button
                onClick={() => setFeedMode("foryou")}
                style={{
                  background: feedMode === "foryou" ? "#3b82f6" : "#1e293b",
                  color: "#fff"
                }}
              >
                🔥 For You
              </button>

              <button
                onClick={() => setFeedMode("following")}
                style={{
                  background: feedMode === "following" ? "#3b82f6" : "#1e293b",
                  color: "#fff"
                }}
              >
                👥 Following
              </button>
            </div>

            {/* POST */}
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Post..." />
            <input type="file" onChange={e => setFile(e.target.files[0])} />
            <button onClick={createPost}>Post</button>

            {/* FEED */}
            {(feedMode === "foryou"
              ? getTrendingPosts()
              : getFollowingPosts()
            ).map(p => (
              <div key={p.id} style={styles.card}>
                <strong onClick={() => setSelectedProfile({ id: p.userId, username: p.username })}>
                  @{p.username}
                </strong>

                <p>{p.text}</p>
                {p.image && <img src={p.image} style={styles.image} />}

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button onClick={() => toggleLike(p)}>
                    {(p.likes || []).includes(user.uid) ? "💖" : "🤍"} {(p.likes || []).length}
                  </button>

                  <button
                    onClick={() => {
                      setChatUser({ id: p.userId, username: p.username });
                      setTab("chat");
                    }}
                  >
                    💬
                  </button>

                  <button
                    onClick={() => {
                      addDoc(collection(db, "reports"), {
                        postId: p.id,
                        createdAt: Date.now()
                      });
                      alert("Reported");
                    }}
                  >
                    🚨
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* PROFILE */}
        {selectedProfile && (
          <>
            <button onClick={() => setSelectedProfile(null)}>← Back</button>
            <h2>@{selectedProfile.username}</h2>

            {selectedProfile.id !== user.uid && (
              <button onClick={() => toggleFollow(selectedProfile.id)}>
                {userData?.following?.includes(selectedProfile.id)
                  ? "Unfollow"
                  : "Follow"}
              </button>
            )}

            {userPosts(selectedProfile.id).map(p => (
              <div key={p.id} style={styles.card}>
                <p>{p.text}</p>
                {p.image && <img src={p.image} style={styles.image} />}
              </div>
            ))}
          </>
        )}
      </div>

      <div style={styles.nav}>
        <button onClick={() => setTab("home")}>🏠</button>
        <button onClick={() => setTab("search")}>🔍</button>
        <button onClick={() => setTab("notifications")}>🔔</button>
        <button onClick={() => setTab("chat")}>💬</button>
      </div>
    </div>
  );
}

const styles = {
  app: { background: "#0f172a", minHeight: "100vh", color: "#fff" },
  container: { maxWidth: 500, margin: "auto", padding: 20 },
  card: {
    background: "#1e293b",
    padding: 10,
    marginTop: 10,
    borderRadius: 10
  },
  image: { width: "100%", borderRadius: 10 },
  nav: {
    position: "fixed",
    bottom: 0,
    width: "100%",
    display: "flex",
    justifyContent: "space-around",
    background: "#1e293b",
    padding: 10
  }
};

createRoot(document.getElementById("root")).render(<App />);
