import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA (handles push + offline)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Check for updates every 5 minutes (not 60s to reduce interruptions)
      setInterval(() => reg.update(), 5 * 60 * 1000);

      // When a new SW is found, DON'T auto-activate — show a banner instead
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New version available — show update banner instead of force-reloading
            showUpdateBanner(newWorker);
          }
        });
      });
    }).catch(() => {
      // VitePWA handles SW in production; manual fallback for dev
    });
  });

  // Only reload when the user explicitly accepted the update
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing && window.__SW_UPDATE_ACCEPTED) {
      refreshing = true;
      window.location.reload();
    }
  });
}

declare global {
  interface Window {
    __SW_UPDATE_ACCEPTED?: boolean;
  }
}

function showUpdateBanner(worker: ServiceWorker) {
  // Don't show if already visible
  if (document.getElementById("sw-update-banner")) return;

  const banner = document.createElement("div");
  banner.id = "sw-update-banner";
  banner.style.cssText = `
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    z-index: 99999; display: flex; align-items: center; gap: 12px;
    background: #1C2128; color: #E2E8F0; border: 1px solid rgba(255,255,255,0.15);
    border-radius: 12px; padding: 12px 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    font-family: system-ui, sans-serif; font-size: 14px; animation: slideUp 0.3s ease;
  `;
  banner.innerHTML = `
    <span>🔄 Nova versão disponível</span>
    <button id="sw-update-btn" style="
      background: #22C55E; color: white; border: none; border-radius: 8px;
      padding: 6px 16px; font-weight: 600; font-size: 13px; cursor: pointer;
    ">Atualizar</button>
    <button id="sw-dismiss-btn" style="
      background: transparent; color: #94A3B8; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer;
    ">Depois</button>
  `;

  // Add animation keyframes
  if (!document.getElementById("sw-update-style")) {
    const style = document.createElement("style");
    style.id = "sw-update-style";
    style.textContent = `@keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`;
    document.head.appendChild(style);
  }

  document.body.appendChild(banner);

  document.getElementById("sw-update-btn")!.addEventListener("click", () => {
    window.__SW_UPDATE_ACCEPTED = true;
    worker.postMessage("skipWaiting");
    banner.remove();
  });

  document.getElementById("sw-dismiss-btn")!.addEventListener("click", () => {
    banner.remove();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
