import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-update service worker — no manual cache clearing needed
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", {
        updateViaCache: "none", // always check for new SW from network
      });

      // Check for updates every 30 minutes
      setInterval(() => reg.update(), 30 * 60 * 1000);

      // When a new SW is found, activate it immediately
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            newWorker.postMessage("skipWaiting");
          }
        });
      });

      // When the new SW takes over, reload to get fresh content
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    } catch {
      // ignore
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
