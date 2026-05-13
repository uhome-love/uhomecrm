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
// (desativado em hosts de preview Lovable, que bloqueiam fetch interno por CORS)
const isLovablePreview =
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("id-preview--");

if (!isLovablePreview) {
  window.setTimeout(checkAppVersion, 5_000);
  window.setInterval(checkAppVersion, VERSION_POLL_MS);

  // Re-checa quando usuário volta para a aba (caso de PC ligado horas)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkAppVersion();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
