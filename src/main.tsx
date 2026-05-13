import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installFetchCircuitBreaker } from "./lib/fetchCircuitBreaker";

// ─────────────────────────────────────────────────────────────────────────────
// LIMPEZA GERAL DE CACHE NO BOOT
// Roda ANTES de tudo. Garante que computadores presos em build antiga
// (login que não entra, pipeline que não carrega) sejam recuperados.
// ─────────────────────────────────────────────────────────────────────────────
async function nukeStaleCachesAndWorkers() {
  // 1) Desregistra TODOS os service workers (kill-switch publicado em /sw.js
  //    fará o mesmo, mas garantimos aqui caso o SW antigo nunca atualize)
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
  } catch {}

  // 2) Apaga todos os caches do CacheStorage
  try {
    if (typeof caches !== "undefined") {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n).catch(() => false)));
    }
  } catch {}
}

// Detecta se a URL contém o sinalizador de recuperação ou se o último boot
// terminou em erro fatal — nesses casos fazemos limpeza síncrona pesada
// antes de montar o app.
const RECOVERY_FLAG = "_recover";
const url = new URL(window.location.href);
const needsHardRecovery = url.searchParams.has(RECOVERY_FLAG);

if (needsHardRecovery) {
  // Limpa storages locais para que o /auth abra 100% limpo
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  // Remove o parâmetro para não reentrar em loop
  url.searchParams.delete(RECOVERY_FLAG);
  window.history.replaceState({}, "", url.toString());
}

// Dispara limpeza em background — não bloqueia o boot
void nukeStaleCachesAndWorkers();

// Instala o monitor passivo de fetch (somente telemetria, não derruba sessão)
installFetchCircuitBreaker();

// ─────────────────────────────────────────────────────────────────────────────
// VERSÃO OBRIGATÓRIA — força reload se o servidor publicou nova build
// ─────────────────────────────────────────────────────────────────────────────
const VERSION_POLL_MS = 60_000; // checa a cada 60s
let knownVersion: string | null = null;

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
      return;
    }
    if (v !== knownVersion) {
      knownVersion = v;
      // Nova build → recarrega com cache-bust para baixar bundle novo
      const next = new URL(window.location.href);
      next.searchParams.set("_v", v);
      window.location.replace(next.toString());
    }
  } catch {
    // silencioso — falha de rede não pode quebrar o app
  }
}

// Primeira checagem após boot e depois periodicamente
window.setTimeout(checkAppVersion, 5_000);
window.setInterval(checkAppVersion, VERSION_POLL_MS);

// Re-checa quando usuário volta para a aba (caso de PC ligado horas)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void checkAppVersion();
});

createRoot(document.getElementById("root")!).render(<App />);
