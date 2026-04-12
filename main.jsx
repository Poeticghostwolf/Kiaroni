import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Kiaroni 🚀</h1>
      <p>It finally works.</p>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
