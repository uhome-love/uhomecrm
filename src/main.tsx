import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installFetchCircuitBreaker } from "./lib/fetchCircuitBreaker";

// Install BEFORE any Supabase client call so all fetches are intercepted
installFetchCircuitBreaker();

// Guard: never register SW inside iframes or preview hosts
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if ("serviceWorker" in navigator && !isInIframe && !isPreviewHost) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", {
        updateViaCache: "none",
      });

      // Check for updates every 5 minutes
      setInterval(() => reg.update(), 5 * 60 * 1000);

      // Check when user returns to the app
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update();
      });

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
} else if ("serviceWorker" in navigator && (isInIframe || isPreviewHost)) {
  // Unregister any existing SWs in preview/iframe to avoid stale cache
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

createRoot(document.getElementById("root")!).render(<App />);
