import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyDLwujgVQGVc9I909EkAkaal3BLobQTSBw",
  authDomain: "kiaroni.firebaseapp.com",
  projectId: "kiaroni"
};

function App() {
  const [status, setStatus] = useState("Connecting...");

  useEffect(() => {
    try {
      initializeApp(firebaseConfig);
      setStatus("Firebase Connected ✅");
    } catch (e) {
      console.error(e);
      setStatus("Firebase Failed ❌");
    }
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Kiaroni 🔥</h1>
      <p>{status}</p>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
