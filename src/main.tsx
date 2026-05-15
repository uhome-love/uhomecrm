// Kill switch one-shot: limpa SW antigo / caches / IDB para usuários que
// ainda têm bundle do período 13–15/05. Roda no máximo uma vez por dispositivo.
import { runKillSwitch } from "./lib/swKillSwitch";
runKillSwitch();

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ─────────────────────────────────────────────────────────────────────────────
// Recovery flags — link de emergência aceita ?_recover, ?recover, ?clear_cache, ?reset_app
// Limpa storages e abre /auth?recovered=1.
// ─────────────────────────────────────────────────────────────────────────────
const RECOVERY_FLAGS = ["_recover", "recover", "clear_cache", "reset_app"] as const;
const url = new URL(window.location.href);
const triggeredFlag = RECOVERY_FLAGS.find((f) => url.searchParams.has(f));

if (triggeredFlag) {
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  try {
    const anyIDB: any = (window as any).indexedDB;
    if (anyIDB?.databases) {
      anyIDB.databases().then((dbs: any[]) => {
        dbs?.forEach((db) => db?.name && anyIDB.deleteDatabase(db.name));
      }).catch(() => {});
    }
  } catch {}
  RECOVERY_FLAGS.forEach((f) => url.searchParams.delete(f));
  url.pathname = "/auth";
  url.searchParams.set("recovered", "1");
  window.history.replaceState({}, "", url.toString());
}

// Limpeza one-shot do estado legado de failover (Runtime v3 → v5).
try {
  localStorage.removeItem("uhome:host:pinned");
  localStorage.removeItem("uhome:host:flips");
} catch {}

// ─────────────────────────────────────────────────────────────────────────────
// Service Worker — registra o SW resiliente (Stale-While-Revalidate)
// ─────────────────────────────────────────────────────────────────────────────
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

      // Check for updates a cada 5 minutos
      setInterval(() => reg.update(), 5 * 60 * 1000);

      // Re-checa quando volta para a aba
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update();
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

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    } catch {
      // ignore
    }
  });
} else if ("serviceWorker" in navigator && (isInIframe || isPreviewHost)) {
  // Em previews, garantir zero SW para não cachear iframe
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

createRoot(document.getElementById("root")!).render(<App />);
