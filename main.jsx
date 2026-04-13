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
  doc,
  setDoc,
  getDoc,
  updateDoc
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
  const [tab, setTab] = useState("home");

  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState(null);
  const [userData, setUserData] = useState(null);

  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [commentText, setCommentText] = useState({});
  const [comments, setComments] = useState([]);

  useEffect(() => {
    async function init() {
      const res = await signInAnonymously(auth);
      setUser(res.user);

      const userRef = doc(db, "users", res.user.uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        setSavedUsername(snap.data().username);
      }

      onSnapshot(userRef, (s) => {
        if (s.exists()) setUserData(s.data());
      });

      onSnapshot(query(collection(db, "posts")), (snapshot) => {
        const data = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        data.sort((a, b) => b.createdAt - a.createdAt);
        setPosts(data);
        setLoading(false);
      });

      onSnapshot(query(collection(db, "notifications")), (snapshot) => {
        const data = snapshot.docs.map(d => d.data());
        const mine = data.filter(n => n.toUser === res.user.uid);
        setNotifications(mine);
        setUnreadCount(mine.length);
      });

      onSnapshot(query(collection(db, "comments")), (snapshot) => {
        const data = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        setComments(data);
      });
    }

    init();
  }, []);

  async function saveUsername() {
    if (!username) return;

    await setDoc(doc(db, "users", user.uid), {
      username,
      following: [],
      followers: []
    });

    setSavedUsername(username);
  }

  async function toggleFollow(targetUserId) {
    const myRef = doc(db, "users", user.uid);
    const theirRef = doc(db, "users", targetUserId);

    const mySnap = await getDoc(myRef);
    const theirSnap = await getDoc(theirRef);

    const myData = mySnap.data() || {};
    const theirData = theirSnap.data() || {};

    const following = myData.following || [];
    const followers = theirData.followers || [];

    const isFollowing = following.includes(targetUserId);

    if (isFollowing) {
      await setDoc(myRef, {
        ...myData,
        following: following.filter(id => id !== targetUserId)
      });

      await setDoc(theirRef, {
        ...theirData,
        followers: followers.filter(id => id !== user.uid)
      });
    } else {
      await setDoc(myRef, {
        ...myData,
        following: [...following, targetUserId]
      });

      await setDoc(theirRef, {
        ...theirData,
        followers: [...followers, user.uid]
      });
    }
  }

  async function toggleLike(post) {
    const ref = doc(db, "posts", post.id);
    const currentLikes = post.likes || [];

    let updated;

    if (currentLikes.includes(user.uid)) {
      updated = currentLikes.filter(id => id !== user.uid);
    } else {
      updated = [...currentLikes, user.uid];

      if (post.userId !== user.uid) {
        await addDoc(collection(db, "notifications"), {
          type: "like",
          toUser: post.userId,
          fromUser: savedUsername,
          createdAt: Date.now()
        });
      }
    }

    await updateDoc(ref, { likes: updated });
  }

  async function addComment(postId, postUserId) {
    const text = commentText[postId];
    if (!text) return;

    await addDoc(collection(db, "comments"), {
      postId,
      text,
      username: savedUsername,
      createdAt: Date.now()
    });

    if (postUserId !== user.uid) {
      await addDoc(collection(db, "notifications"), {
        type: "comment",
        toUser: postUserId,
        fromUser: savedUsername,
        text,
        createdAt: Date.now()
      });
    }

    setCommentText(prev => ({ ...prev, [postId]: "" }));
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

  function filteredPosts() {
    if (!userData) return posts;

    const following = userData.following || [];

    return posts.filter(
      p => following.includes(p.userId) || p.userId === user.uid
    );
  }

  function myPosts() {
    return posts.filter(p => p.userId === user.uid);
  }

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Kiaroni 🔥</h1>

      {/* USERNAME */}
      {!savedUsername && (
        <div style={styles.card}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose username"
          />
          <button onClick={saveUsername}>Save</button>
        </div>
      )}

      {/* HOME */}
      {tab === "home" && (
        <>
          <div style={styles.card}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's happening?"
            />
            <button onClick={createPost}>Post</button>
          </div>

          {filteredPosts().map(p => {
            const following = userData?.following || [];
            const isFollowing = following.includes(p.userId);

            return (
              <div key={p.id} style={styles.card}>
                <strong>@{p.username}</strong>

                {p.userId !== user.uid && (
                  <button onClick={() => toggleFollow(p.userId)}>
                    {isFollowing ? "Unfollow" : "Follow"}
                  </button>
                )}

                <p>{p.text}</p>

                <button onClick={() => toggleLike(p)}>
                  ❤️ {(p.likes || []).length}
                </button>

                <div>
                  <input
                    value={commentText[p.id] || ""}
                    onChange={(e) =>
                      setCommentText({
                        ...commentText,
                        [p.id]: e.target.value
                      })
                    }
                  />
                  <button onClick={() => addComment(p.id, p.userId)}>
                    Reply
                  </button>

                  {comments
                    .filter(c => c.postId === p.id)
                    .map(c => (
                      <p key={c.id}>
                        @{c.username}: {c.text}
                      </p>
                    ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* NOTIFICATIONS */}
      {tab === "notifications" && (
        <div style={styles.card}>
          <h2>🔔 Notifications ({unreadCount})</h2>
          {notifications.map((n, i) => (
            <p key={i}>
              {n.type === "like" && `❤️ ${n.fromUser} liked your post`}
              {n.type === "comment" && `💬 ${n.fromUser}: ${n.text}`}
            </p>
          ))}
        </div>
      )}

      {/* PROFILE */}
      {tab === "profile" && (
        <div style={styles.card}>
          <h2>@{savedUsername}</h2>
          <p>Followers: {(userData?.followers || []).length}</p>
          <p>Following: {(userData?.following || []).length}</p>

          {myPosts().map(p => (
            <p key={p.id}>{p.text}</p>
          ))}
        </div>
      )}

      {/* NAV */}
      <div style={styles.nav}>
        <button onClick={() => setTab("home")}>🏠</button>
        <button onClick={() => setTab("notifications")}>
          🔔 {unreadCount > 0 && `(${unreadCount})`}
        </button>
        <button onClick={() => setTab("profile")}>👤</button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: 20,
    background: "#0f172a",
    color: "#fff",
    minHeight: "100vh"
  },
  title: { textAlign: "center" },
  card: {
    background: "#1e293b",
    padding: 15,
    marginTop: 10,
    borderRadius: 10
  },
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "space-around",
    background: "#1e293b",
    padding: 10
  }
};

createRoot(document.getElementById("root")).render(<App />);
