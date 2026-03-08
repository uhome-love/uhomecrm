import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA (handles push + offline)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // VitePWA handles SW in production; manual fallback for dev
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
