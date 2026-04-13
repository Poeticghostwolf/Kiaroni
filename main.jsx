// ⚠️ Only showing NEW + UPDATED parts (rest stays same)

// 🔽 ADD STATES (inside App)
const [bio, setBio] = useState("");
const [avatarFile, setAvatarFile] = useState(null);

// 🔽 UPDATE saveUsername (REPLACE)
async function saveUsername() {
  if (!username) return;

  await setDoc(doc(db, "users", user.uid), {
    username,
    bio: "",
    avatar: "",
    followers: [],
    following: []
  });

  setSavedUsername(username);
}

// 🔽 ADD AVATAR UPLOAD
async function uploadAvatar(file) {
  if (!file) return null;

  const storageRef = ref(storage, `avatars/${user.uid}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

// 🔽 ADD UPDATE PROFILE FUNCTION
async function updateProfile() {
  let avatarUrl = userData?.avatar || "";

  if (avatarFile) {
    avatarUrl = await uploadAvatar(avatarFile);
  }

  await updateDoc(doc(db, "users", user.uid), {
    bio,
    avatar: avatarUrl
  });

  setAvatarFile(null);
}

// 🔽 ADD PROFILE TAB BUTTON
<button onClick={() => setTab("profile")}>👤</button>

// 🔽 ADD PROFILE TAB UI (IMPORTANT)
{tab === "profile" && !selectedProfile && (
  <>
    <h2>Your Profile</h2>

    {userData?.avatar && (
      <img src={userData.avatar} style={{ width: 100, borderRadius: "50%" }} />
    )}

    <input
      type="file"
      onChange={e => setAvatarFile(e.target.files[0])}
    />

    <textarea
      value={bio}
      onChange={e => setBio(e.target.value)}
      placeholder="Your bio..."
    />

    <button onClick={updateProfile}>Save Profile</button>
  </>
)}

// 🔽 UPDATE OTHER USERS PROFILE VIEW (ADD THIS UNDER NAME)
<p>{users.find(u => u.id === selectedProfile.id)?.bio}</p>

{users.find(u => u.id === selectedProfile.id)?.avatar && (
  <img
    src={users.find(u => u.id === selectedProfile.id)?.avatar}
    style={{ width: 80, borderRadius: "50%" }}
  />
)}
