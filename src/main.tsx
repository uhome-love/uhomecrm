import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA (handles push + offline)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Check for updates every 60 seconds
      setInterval(() => reg.update(), 60 * 1000);

      // Auto-activate waiting SW
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New version available — activate immediately
            newWorker.postMessage("skipWaiting");
          }
        });
      });
    }).catch(() => {
      // VitePWA handles SW in production; manual fallback for dev
    });
  });

  // Reload page when new SW takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
