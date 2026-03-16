import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker conservatively to avoid stale published UI
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await reg.update();

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            newWorker.postMessage("skipWaiting");
          }
        });
      });
    } catch {
      // ignore service worker registration errors
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
