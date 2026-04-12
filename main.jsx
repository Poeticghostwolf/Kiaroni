import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDLwujgVQGVc9I909EkAkaal3BLobQTSBw",
  authDomain: "kiaroni.firebaseapp.com",
  projectId: "kiaroni"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function App() {
  const [status, setStatus] = useState("Connecting...");
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const res = await signInAnonymously(auth);
        setUser(res.user);
        setStatus("Logged in anonymously ✅");
      } catch (e) {
        console.error(e);
        setStatus("Auth failed ❌");
      }
    }

    init();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Kiaroni 🔥</h1>
      <p>{status}</p>

      {user && (
        <p style={{ fontSize: 12 }}>
          User ID: {user.uid}
        </p>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
