import React, { useEffect, useMemo, useState } from "react";
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
  const [userData, setUserData] = useState(null);
  const [savedUsername, setSavedUsername] = useState("");
  const [usernameInput, setUsernameInput] = useState("");

  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [popup, setPopup] = useState("");

  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");

  const [swipeQueue, setSwipeQueue] = useState([]);

  const [chatUser, setChatUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState("");

  const [selectedProfile, setSelectedProfile] = useState(null);

  useEffect(() => {
    const unsubscribers = [];
    let mounted = true;

    async function init() {
      try {
        const res = await signInAnonymously(auth);
        if (!mounted) return;

        setUser(res.user);

        const userRef = doc(db, "users", res.user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists() && mounted) {
          const data = userSnap.data();
          setSavedUsername(data.username || "");
          setUserData(data);
        }

        unsubscribers.push(
          onSnapshot(userRef, snap => {
            if (!snap.exists()) return;
            const data = snap.data();
            setUserData(data);
            setSavedUsername(data.username || "");
          })
        );

        unsubscribers.push(
          onSnapshot(collection(db, "users"), snap => {
            const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setUsers(allUsers);
            setSwipeQueue(allUsers.filter(u => u.id !== res.user.uid));
          })
        );

        unsubscribers.push(
          onSnapshot(collection(db, "posts"), snap => {
            const allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setPosts(
              allPosts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            );
          })
        );

        unsubscribers.push(
          onSnapshot(collection(db, "reports"), snap => {
            const allReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setReports(
              allReports.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            );
          })
        );

        unsubscribers.push(
          onSnapshot(collection(db, "notifications"), snap => {
            const mine = snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter(n => n.toUser === res.user.uid)
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            setNotifications(mine);

            if (mine.length > 0) {
              const latest = mine[0];
              setPopup(latest.text || "");

              window.clearTimeout(window.__kiaroniPopupTimer);
              window.__kiaroniPopupTimer = window.setTimeout(() => {
                setPopup("");
              }, 3000);
            }
          })
        );
      } catch (error) {
        console.error("Init error:", error);
      }
    }

    init();

    return () => {
      mounted = false;
      unsubscribers.forEach(unsub => {
        try {
          unsub();
        } catch {}
      });
      window.clearTimeout(window.__kiaroniPopupTimer);
    };
  }, []);

  useEffect(() => {
    if (!user || !chatUser) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, "messages"),
      where("participants", "array-contains", user.uid)
    );

    const unsub = onSnapshot(q, snap => {
      const filtered = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(
          m =>
            Array.isArray(m.participants) &&
            m.participants.includes(chatUser.id)
        )
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      setMessages(filtered);
    });

    return () => unsub();
  }, [user, chatUser]);

  const smartFeed = useMemo(() => {
    return [...posts]
      .map(post => {
        const likes = Array.isArray(post.likes) ? post.likes.length : 0;
        const age = Date.now() - (post.createdAt || 0);
        const recencyBoost =
          age < 60 * 60 * 1000 ? 20 : age < 24 * 60 * 60 * 1000 ? 8 : 0;

        return {
          ...post,
          score: likes * 10 + recencyBoost
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [posts]);

  function resetToTab(nextTab) {
    setSelectedProfile(null);
    setTab(nextTab);
  }

  function getUserById(id) {
    return users.find(u => u.id === id) || null;
  }

  function openProfile(profileUserId) {
    const profileUser = getUserById(profileUserId);
    if (!profileUser) return;
    setSelectedProfile(profileUser);
  }

  async function createUserIfNeeded() {
    if (!user || !usernameInput.trim()) return;

    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setSavedUsername(data.username || "");
        return;
      }

      const existingUsers = await getDocs(collection(db, "users"));
      const isFirstUser = existingUsers.empty;

      await setDoc(userRef, {
        username: usernameInput.trim(),
        isAdmin: isFirstUser,
        followers: [],
        following: [],
        avatar: "",
        createdAt: Date.now()
      });

      setSavedUsername(usernameInput.trim());
      setUsernameInput("");
    } catch (error) {
      console.error("Create user error:", error);
    }
  }

  async function createPost() {
    if (!user || !savedUsername) return;
    if (!text.trim() && !file) return;

    try {
      let imageUrl = "";

      if (file) {
        const storageRef = ref(
          storage,
          `posts/${user.uid}/${Date.now()}_${file.name}`
        );
        await uploadBytes(storageRef, file);
        imageUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, "posts"), {
        text: text.trim(),
        image: imageUrl,
        userId: user.uid,
        username: savedUsername,
        likes: [],
        createdAt: Date.now()
      });

      setText("");
      setFile(null);
      setPreview("");
    } catch (error) {
      console.error("Create post error:", error);
    }
  }

  async function toggleLike(post) {
    if (!user) return;

    try {
      const postRef = doc(db, "posts", post.id);
      const likes = Array.isArray(post.likes) ? post.likes : [];
      const updatedLikes = likes.includes(user.uid)
        ? likes.filter(id => id !== user.uid)
        : [...likes, user.uid];

      await updateDoc(postRef, { likes: updatedLikes });

      if (!likes.includes(user.uid) && post.userId !== user.uid) {
        await addDoc(collection(db, "notifications"), {
          toUser: post.userId,
          text: `${savedUsername} liked your post`,
          createdAt: Date.now()
        });
      }
    } catch (error) {
      console.error("Toggle like error:", error);
    }
  }

  async function reportPost(post) {
    if (!user) return;

    try {
      await addDoc(collection(db, "reports"), {
        postId: post.id,
        reportedUser: post.userId,
        reportedBy: user.uid,
        text: post.text || "",
        createdAt: Date.now()
      });

      setPopup("Report submitted");
      window.clearTimeout(window.__kiaroniPopupTimer);
      window.__kiaroniPopupTimer = window.setTimeout(() => {
        setPopup("");
      }, 2500);
    } catch (error) {
      console.error("Report error:", error);
    }
  }

  async function swipe(targetId, liked) {
    if (!user) return;

    try {
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
            toUser: targetId,
            text: "🔥 It's a match!",
            createdAt: Date.now()
          });

          setPopup("🔥 It's a match!");
          window.clearTimeout(window.__kiaroniPopupTimer);
          window.__kiaroniPopupTimer = window.setTimeout(() => {
            setPopup("");
          }, 3000);
        }
      }

      setSwipeQueue(prev => prev.filter(u => u.id !== targetId));
    } catch (error) {
      console.error("Swipe error:", error);
    }
  }

  async function sendMessage() {
    if (!user || !chatUser || !chatText.trim()) return;

    try {
      await addDoc(collection(db, "messages"), {
        text: chatText.trim(),
        from: user.uid,
        to: chatUser.id,
        participants: [user.uid, chatUser.id],
        createdAt: Date.now()
      });

      if (chatUser.id !== user.uid) {
        await addDoc(collection(db, "notifications"), {
          toUser: chatUser.id,
          text: `${savedUsername} sent you a message`,
          createdAt: Date.now()
        });
      }

      setChatText("");
    } catch (error) {
      console.error("Send message error:", error);
    }
  }

  const profilePosts = selectedProfile
    ? posts.filter(post => post.userId === selectedProfile.id)
    : [];

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <img
          src="/kiaroni-logo-dark.png"
          alt="Kiaroni"
          style={styles.logo}
        />
      </div>

      <div style={styles.container}>
        {!savedUsername && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Welcome</h2>
            <input
              style={styles.input}
              placeholder="Choose a username"
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") createUserIfNeeded();
              }}
            />
            <button style={styles.primaryButton} onClick={createUserIfNeeded}>
              Continue
            </button>
          </div>
        )}

        {savedUsername && popup && <div style={styles.popup}>{popup}</div>}

        {savedUsername && selectedProfile && (
          <div style={styles.card}>
            <button
              style={styles.secondaryButton}
              onClick={() => setSelectedProfile(null)}
            >
              ← Back
            </button>

            <h2 style={styles.sectionTitle}>@{selectedProfile.username}</h2>
            <p style={styles.metaText}>User ID: {selectedProfile.id}</p>

            {profilePosts.length === 0 ? (
              <p style={styles.metaText}>No posts yet.</p>
            ) : (
              profilePosts.map(post => (
                <div key={post.id} style={styles.postCard}>
                  <p style={styles.postText}>{post.text}</p>
                  {post.image ? (
                    <img src={post.image} alt="" style={styles.postImage} />
                  ) : null}
                </div>
              ))
            )}
          </div>
        )}

        {savedUsername && !selectedProfile && tab === "home" && (
          <>
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Create Post</h2>
              <textarea
                style={styles.textarea}
                placeholder="What's on your mind?"
                value={text}
                onChange={e => setText(e.target.value)}
              />
              <input
                style={styles.input}
                type="file"
                accept="image/*"
                onChange={e => {
                  const selected = e.target.files?.[0];
                  setFile(selected || null);
                  setPreview(selected ? URL.createObjectURL(selected) : "");
                }}
              />
              {preview ? (
                <img src={preview} alt="Preview" style={styles.postImage} />
              ) : null}
              <button style={styles.primaryButton} onClick={createPost}>
                Post
              </button>
            </div>

            {smartFeed.map(post => (
              <div key={post.id} style={styles.card}>
                <button
                  style={styles.userLink}
                  onClick={() => openProfile(post.userId)}
                >
                  @{post.username}
                </button>

                <p style={styles.postText}>{post.text}</p>

                {post.image ? (
                  <img src={post.image} alt="" style={styles.postImage} />
                ) : null}

                <div style={styles.actions}>
                  <button
                    style={styles.actionButton}
                    onClick={() => toggleLike(post)}
                  >
                    {(post.likes || []).includes(user?.uid) ? "❤️" : "🤍"}{" "}
                    {(post.likes || []).length}
                  </button>

                  <button
                    style={styles.actionButton}
                    onClick={() =>
                      setChatUser({
                        id: post.userId,
                        username: post.username
                      })
                    }
                  >
                    💬
                  </button>

                  <button
                    style={styles.actionButton}
                    onClick={() => reportPost(post)}
                  >
                    🚨
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {savedUsername && !selectedProfile && tab === "swipe" && (
          <div style={styles.swipeWrap}>
            {swipeQueue.length > 0 ? (
              <div style={styles.swipeCard}>
                <h2 style={styles.sectionTitle}>@{swipeQueue[0].username}</h2>
                <p style={styles.metaText}>Discover new people on Kiaroni</p>

                <div style={styles.swipeActions}>
                  <button
                    style={styles.dislikeButton}
                    onClick={() => swipe(swipeQueue[0].id, false)}
                  >
                    ❌
                  </button>
                  <button
                    style={styles.likeButton}
                    onClick={() => swipe(swipeQueue[0].id, true)}
                  >
                    💖
                  </button>
                </div>

                <button
                  style={styles.secondaryButton}
                  onClick={() =>
                    setChatUser({
                      id: swipeQueue[0].id,
                      username: swipeQueue[0].username
                    })
                  }
                >
                  Message
                </button>
              </div>
            ) : (
              <div style={styles.card}>
                <h2 style={styles.sectionTitle}>No more profiles right now</h2>
                <p style={styles.metaText}>Check back later.</p>
              </div>
            )}
          </div>
        )}

        {savedUsername && !selectedProfile && tab === "profile" && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Your Profile</h2>
            <p style={styles.metaText}>@{savedUsername}</p>
            <p style={styles.metaText}>UID: {user?.uid}</p>
            <p style={styles.metaText}>
              Role: {userData?.isAdmin ? "Admin" : "User"}
            </p>

            {notifications.length > 0 ? (
              <div style={{ marginTop: 16 }}>
                <h3 style={styles.subTitle}>Recent Notifications</h3>
                {notifications.slice(0, 5).map(note => (
                  <div key={note.id} style={styles.notificationItem}>
                    {note.text}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {savedUsername &&
          !selectedProfile &&
          tab === "admin" &&
          userData?.isAdmin && (
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Admin Panel</h2>

              {reports.length === 0 ? (
                <p style={styles.metaText}>No reports yet.</p>
              ) : (
                reports.map(report => (
                  <div key={report.id} style={styles.reportItem}>
                    <div>
                      <strong>Post:</strong> {report.postId}
                    </div>
                    <div>
                      <strong>Reported user:</strong> {report.reportedUser}
                    </div>
                    <div>
                      <strong>Reported by:</strong> {report.reportedBy}
                    </div>
                    <div>
                      <strong>Text:</strong> {report.text || "—"}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
      </div>

      {chatUser && (
        <div style={styles.chatOverlay}>
          <div style={styles.chatModal}>
            <div style={styles.chatHeader}>
              <strong>@{chatUser.username || "User"}</strong>
              <button
                style={styles.chatClose}
                onClick={() => setChatUser(null)}
              >
                ✕
              </button>
            </div>

            <div style={styles.chatMessages}>
              {messages.length === 0 ? (
                <div style={styles.metaText}>No messages yet.</div>
              ) : (
                messages.map(message => {
                  const mine = message.from === user?.uid;
                  return (
                    <div
                      key={message.id}
                      style={mine ? styles.myMsgWrap : styles.theirMsgWrap}
                    >
                      <div style={mine ? styles.myMsg : styles.theirMsg}>
                        {message.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={styles.chatInputWrap}>
              <input
                style={styles.chatInput}
                value={chatText}
                placeholder="Type a message..."
                onChange={e => setChatText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") sendMessage();
                }}
              />
              <button style={styles.sendBtn} onClick={sendMessage}>
                ➤
              </button>
            </div>
          </div>
        </div>
      )}

      {savedUsername && (
        <div style={styles.nav}>
          <button
            style={tab === "home" ? styles.navButtonActive : styles.navButton}
            onClick={() => resetToTab("home")}
          >
            🏠
          </button>

          <button
            style={tab === "swipe" ? styles.navButtonActive : styles.navButton}
            onClick={() => resetToTab("swipe")}
          >
            🔥
          </button>

          <button
            style={tab === "profile" ? styles.navButtonActive : styles.navButton}
            onClick={() => resetToTab("profile")}
          >
            👤
          </button>

          {userData?.isAdmin && (
            <button
              style={tab === "admin" ? styles.navButtonActive : styles.navButton}
              onClick={() => resetToTab("admin")}
            >
              🛡️
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    color: "#fff",
    backgroundImage: `
      linear-gradient(rgba(8,12,30,0.78), rgba(8,12,30,0.88)),
      url('/kiaroni-bg.jpg')
    `,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
    paddingBottom: 90
  },

  header: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 20
  },

  logo: {
    width: 220,
    maxWidth: "90%",
    objectFit: "contain",
    filter: "drop-shadow(0 0 14px rgba(124,58,237,0.45))"
  },

  container: {
    maxWidth: 620,
    margin: "0 auto",
    padding: "0 16px"
  },

  card: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(16px)",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    boxShadow: "0 0 30px rgba(99,102,241,0.15)"
  },

  postCard: {
    background: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 12,
    marginTop: 12
  },

  sectionTitle: {
    margin: "0 0 12px 0",
    fontSize: 24
  },

  subTitle: {
    margin: "0 0 10px 0",
    fontSize: 16
  },

  metaText: {
    color: "#cbd5e1",
    margin: "6px 0"
  },

  input: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "none",
    outline: "none",
    marginBottom: 12,
    fontSize: 15,
    boxSizing: "border-box"
  },

  textarea: {
    width: "100%",
    minHeight: 110,
    padding: 12,
    borderRadius: 12,
    border: "none",
    outline: "none",
    marginBottom: 12,
    fontSize: 15,
    resize: "vertical",
    boxSizing: "border-box"
  },

  primaryButton: {
    background: "linear-gradient(135deg,#7c3aed,#38bdf8)",
    border: "none",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: "0 0 18px rgba(124,58,237,0.35)"
  },

  secondaryButton: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer"
  },

  userLink: {
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: 18,
    fontWeight: 700,
    padding: 0,
    cursor: "pointer"
  },

  postText: {
    margin: "10px 0 12px 0",
    lineHeight: 1.45
  },

  postImage: {
    width: "100%",
    borderRadius: 16,
    display: "block",
    marginBottom: 12
  },

  actions: {
    display: "flex",
    gap: 10
  },

  actionButton: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: 12,
    cursor: "pointer"
  },

  swipeWrap: {
    display: "flex",
    justifyContent: "center"
  },

  swipeCard: {
    width: "100%",
    maxWidth: 420,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(16px)",
    borderRadius: 24,
    padding: 24,
    textAlign: "center",
    boxShadow: "0 0 30px rgba(99,102,241,0.18)"
  },

  swipeActions: {
    display: "flex",
    justifyContent: "center",
    gap: 18,
    margin: "18px 0"
  },

  dislikeButton: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    border: "none",
    fontSize: 28,
    cursor: "pointer",
    background: "linear-gradient(135deg,#ef4444,#f97316)",
    color: "#fff"
  },

  likeButton: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    border: "none",
    fontSize: 28,
    cursor: "pointer",
    background: "linear-gradient(135deg,#7c3aed,#38bdf8)",
    color: "#fff"
  },

  popup: {
    position: "sticky",
    top: 12,
    zIndex: 5,
    marginBottom: 12,
    background: "linear-gradient(135deg,#7c3aed,#38bdf8)",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 14,
    boxShadow: "0 0 18px rgba(124,58,237,0.35)"
  },

  notificationItem: {
    background: "rgba(255,255,255,0.06)",
    padding: 10,
    borderRadius: 12,
    marginBottom: 8
  },

  reportItem: {
    background: "rgba(255,255,255,0.06)",
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    lineHeight: 1.45
  },

  chatOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    zIndex: 50
  },

  chatModal: {
    width: "100%",
    maxWidth: 520,
    height: "70vh",
    background: "rgba(10,15,35,0.94)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 0 30px rgba(99,102,241,0.25)"
  },

  chatHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottom: "1px solid rgba(255,255,255,0.08)"
  },

  chatClose: {
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: 20,
    cursor: "pointer"
  },

  chatMessages: {
    flex: 1,
    overflowY: "auto",
    padding: 14
  },

  myMsgWrap: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: 10
  },

  theirMsgWrap: {
    display: "flex",
    justifyContent: "flex-start",
    marginBottom: 10
  },

  myMsg: {
    background: "linear-gradient(135deg,#7c3aed,#38bdf8)",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: 16,
    maxWidth: "75%"
  },

  theirMsg: {
    background: "rgba(255,255,255,0.1)",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: 16,
    maxWidth: "75%"
  },

  chatInputWrap: {
    display: "flex",
    gap: 10,
    padding: 14,
    borderTop: "1px solid rgba(255,255,255,0.08)"
  },

  chatInput: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    border: "none",
    outline: "none"
  },

  sendBtn: {
    width: 52,
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    background: "linear-gradient(135deg,#7c3aed,#38bdf8)",
    color: "#fff",
    fontSize: 18
  },

  nav: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    justifyContent: "center",
    gap: 12,
    padding: 14,
    background: "rgba(8,12,30,0.72)",
    backdropFilter: "blur(14px)",
    borderTop: "1px solid rgba(255,255,255,0.08)"
  },

  navButton: {
    background: "transparent",
    border: "none",
    color: "#cbd5e1",
    fontSize: 24,
    cursor: "pointer",
    padding: 10,
    borderRadius: 12,
    transition: "0.2s"
  },

  navButtonActive: {
    background: "linear-gradient(135deg,#7c3aed,#38bdf8)",
    border: "none",
    color: "#fff",
    fontSize: 24,
    cursor: "pointer",
    padding: 10,
    borderRadius: 12,
    boxShadow: "0 0 18px rgba(124,58,237,0.45)"
  }
};

createRoot(document.getElementById("root")).render(<App />);
