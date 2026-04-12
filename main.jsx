import React, { useState } from "react";
import { createRoot } from "react-dom/client";

function App() {
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");

  function createPost() {
    if (!text) return;

    setPosts([{ text }, ...posts]);
    setText("");
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>Kiaroni 🔥</h1>

      <div style={{ marginBottom: 20 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something..."
        />
        <button onClick={createPost}>Post</button>
      </div>

      <div>
        {posts.map((p, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <strong>User</strong>
            <p>{p.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
