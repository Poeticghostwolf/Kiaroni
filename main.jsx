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
  const [viewList, setViewList] = useState(null); // followers/following modal

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

  function userPosts(userId) {
    return posts.filter(p => p.userId === userId);
  }

  function findUsers(ids = []) {
    return users.filter(u => ids.includes(u.id));
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
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Post..." />
            <input type="file" onChange={e => setFile(e.target.files[0])} />
            <button onClick={createPost}>Post</button>

            {posts.map(p => (
              <div key={p.id} style={styles.card}>
                <strong onClick={() => setSelectedProfile({ id: p.userId, username: p.username })}>
                  @{p.username}
                </strong>
                <p>{p.text}</p>
                {p.image && <img src={p.image} style={styles.image} />}
              </div>
            ))}
          </>
        )}

        {/* PROFILE */}
        {selectedProfile && (
          <>
            <button onClick={() => setSelectedProfile(null)}>← Back</button>

            <h2>@{selectedProfile.username}</h2>

            {userData && (
              <>
                <p>
                  Followers:{" "}
                  <span onClick={() => setViewList("followers")}>
                    {findUsers(users.find(u => u.id === selectedProfile.id)?.followers || []).length}
                  </span>{" "}
                  | Following:{" "}
                  <span onClick={() => setViewList("following")}>
                    {findUsers(users.find(u => u.id === selectedProfile.id)?.following || []).length}
                  </span>
                </p>

                {selectedProfile.id !== user.uid && (
                  <button onClick={() => toggleFollow(selectedProfile.id)}>
                    {userData.following?.includes(selectedProfile.id)
                      ? "Unfollow"
                      : "Follow"}
                  </button>
                )}
              </>
            )}

            {userPosts(selectedProfile.id).map(p => (
              <div key={p.id} style={styles.card}>
                <p>{p.text}</p>
                {p.image && <img src={p.image} style={styles.image} />}
              </div>
            ))}
          </>
        )}

        {/* FOLLOW LIST VIEW */}
        {viewList && selectedProfile && (
          <div style={styles.modal}>
            <button onClick={() => setViewList(null)}>Close</button>

            {findUsers(
              users.find(u => u.id === selectedProfile.id)?.[viewList] || []
            ).map(u => (
              <div key={u.id} style={styles.card}>
                @{u.username}
              </div>
            ))}
          </div>
        )}

        {/* SEARCH */}
        {tab === "search" && !selectedProfile && (
          <>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." />

            {users
              .filter(u => u.username?.toLowerCase().includes(search.toLowerCase()))
              .map(u => (
                <div
                  key={u.id}
                  style={styles.card}
                  onClick={() => setSelectedProfile(u)}
                >
                  🔍 @{u.username}
                </div>
              ))}
          </>
        )}

        {/* NOTIFICATIONS */}
        {tab === "notifications" && (
          notifications.map((n, i) => (
            <div key={i} style={styles.card}>🔔 {n.text}</div>
          ))
        )}
      </div>

      <div style={styles.nav}>
        <button onClick={() => setTab("home")}>🏠</button>
        <button onClick={() => setTab("search")}>🔍</button>
        <button onClick={() => setTab("notifications")}>🔔</button>
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
  },
  modal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    background: "#0f172a",
    padding: 20
  }
};

createRoot(document.getElementById("root")).render(<App />);
