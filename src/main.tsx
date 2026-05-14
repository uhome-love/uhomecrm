// Kill switch one-shot: limpa SW/caches/IDB antigos antes de tudo.
import { runKillSwitch } from "./lib/swKillSwitch";
runKillSwitch();
// PRIMEIRO import efetivo: captura window.fetch original antes de qualquer patch.
import "./lib/originalFetch";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installFetchCircuitBreaker } from "./lib/fetchCircuitBreaker";

// Detecta se a URL contém o sinalizador de recuperação ou se o último boot
// terminou em erro fatal — nesses casos fazemos limpeza síncrona pesada
// antes de montar o app.
// Aliases aceitos para o link de recuperação enviado aos corretores.
// Qualquer um deles dispara wipe completo do estado local.
const RECOVERY_FLAGS = ["_recover", "recover", "clear_cache", "reset_app"] as const;
const url = new URL(window.location.href);
const triggeredFlag = RECOVERY_FLAGS.find((f) => url.searchParams.has(f));
const needsHardRecovery = !!triggeredFlag;

if (needsHardRecovery) {
  // Limpa storages locais para que o /auth abra 100% limpo
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  // Tenta também limpar IndexedDB (Supabase persiste sessão lá em alguns browsers)
  try {
    const anyIDB: any = (window as any).indexedDB;
    if (anyIDB?.databases) {
      anyIDB.databases().then((dbs: any[]) => {
        dbs?.forEach((db) => db?.name && anyIDB.deleteDatabase(db.name));
      }).catch(() => {});
    }
  } catch {}
  // Remove TODOS os parâmetros de recuperação para não reentrar em loop
  RECOVERY_FLAGS.forEach((f) => url.searchParams.delete(f));
  // Redireciona para /auth?recovered=1 para feedback visual
  url.pathname = "/auth";
  url.searchParams.set("recovered", "1");
  window.history.replaceState({}, "", url.toString());
}

// Instala o monitor passivo de fetch (somente telemetria, não derruba sessão)
installFetchCircuitBreaker();

// ─────────────────────────────────────────────────────────────────────────────
// VERSÃO OBRIGATÓRIA — força reload se o servidor publicou nova build
// ─────────────────────────────────────────────────────────────────────────────
const VERSION_POLL_MS = 60_000; // checa a cada 60s
const LAST_VERSION_KEY = "uhome:app:lastVersion";
let knownVersion: string | null = null;
let cleaningInProgress = false;

// Limpa TUDO que pode segurar bundle antigo (SW, Cache Storage, IndexedDB do app)
// e recarrega. Roda automaticamente quando detectamos build nova no servidor.
async function hardCleanAndReload(newVersion: string) {
  if (cleaningInProgress) return;
  cleaningInProgress = true;
  try {
    // 1. Unregister TODOS os service workers (PWA antigo cacheando shell)
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => undefined)));
    }
    // 2. Limpar Cache Storage (workbox / runtime caches antigos)
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => undefined)));
    }
    // 3. Limpar IndexedDB do app (mantém Supabase/auth para não deslogar)
    if ("indexedDB" in window && "databases" in indexedDB) {
      try {
        const dbs = await (indexedDB as any).databases();
        await Promise.all(
          (dbs || [])
            .filter((db: any) => db?.name && (db.name.includes("uhome") || db.name.includes("workbox")))
            .map(
              (db: any) =>
                new Promise<void>((res) => {
                  const req = indexedDB.deleteDatabase(db.name);
                  req.onsuccess = () => res();
                  req.onerror = () => res();
                  req.onblocked = () => res();
                }),
            ),
        );
      } catch {}
    }
  } catch (err) {
    console.warn("[update] hard clean falhou, recarregando mesmo assim", err);
  }
  try {
    localStorage.setItem(LAST_VERSION_KEY, newVersion);
  } catch {}
  // Reload com cache-bust forte
  const next = new URL(window.location.href);
  next.searchParams.set("_v", newVersion);
  window.location.replace(next.toString());
}

async function checkAppVersion() {
  try {
    const res = await fetch("/version.json?_t=" + Date.now(), {
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) return;
    const data = await res.json();
    const v = String(data?.v ?? "");
    if (!v) return;
    if (knownVersion === null) {
      knownVersion = v;
      // Boot: se a versão guardada localmente é diferente, faz clean automático
      // (cobre o caso de usuário que abriu o app depois do deploy sem ter ficado polling)
      let last: string | null = null;
      try { last = localStorage.getItem(LAST_VERSION_KEY); } catch {}
      if (last && last !== v) {
        void hardCleanAndReload(v);
        return;
      }
      try { localStorage.setItem(LAST_VERSION_KEY, v); } catch {}
      return;
    }
    if (v !== knownVersion) {
      knownVersion = v;
      // Nova build detectada em runtime → limpa tudo e recarrega automaticamente
      void hardCleanAndReload(v);
    }
  } catch {
    // silencioso — falha de rede não pode quebrar o app
  }
}

// Primeira checagem após boot e depois periodicamente
// (desativado em hosts de preview Lovable, que bloqueiam fetch interno por CORS)
const isLovablePreview =
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("id-preview--");

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

if (!isLovablePreview && !isInIframe && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

if (!isLovablePreview) {
  window.setTimeout(checkAppVersion, 5_000);
  window.setInterval(checkAppVersion, VERSION_POLL_MS);

  // Re-checa quando usuário volta para a aba (caso de PC ligado horas)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkAppVersion();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
