// Telemetria de rede client-side.
// - Usa originalFetch (capturado ANTES de qualquer patch) para nunca cair
//   no próprio circuit breaker que está tentando observar.
// - Sanitiza URL e mensagem de erro antes de gravar.
// - Fire-and-forget; em falha, persiste em sessionStorage para flush futuro.
// - Nunca loga chamadas para a própria tabela (anti-loop).

import { originalFetch } from "./originalFetch";

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
// Endpoint REST direto (via proxy próprio, igual ao customClient)
const TELEMETRY_ENDPOINT = "https://api.uhomesales.com/rest/v1/network_telemetry";
const TELEMETRY_PATH_FRAGMENT = "/rest/v1/network_telemetry";

const PENDING_KEY = "uhome:net:pending_telemetry";
const SESSION_KEY = "uhome:net:sid";
const IDENTITY_KEY = "uhome:net:identity";
const MAX_PENDING = 50;

export interface NetworkFailureContext {
  url: string;
  method?: string;
  error_name?: string;
  error_message?: string;
  duration_ms?: number;
  retry_count?: number;
  cf_ray?: string | null;
}

interface TelemetryRow {
  user_id: string | null;
  profile_role: string | null;
  url: string;
  method: string | null;
  error_name: string | null;
  error_message: string | null;
  duration_ms: number | null;
  online: boolean;
  connection_type: string | null;
  user_agent: string;
  origin_host: string;
  retry_count: number;
  cf_ray: string | null;
  session_id: string;
}

// ─── Identidade leve ─────────────────────────────────────────────────────────
export function setTelemetryIdentity(user_id: string | null, role: string | null) {
  try {
    if (!user_id) {
      localStorage.removeItem(IDENTITY_KEY);
      return;
    }
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ user_id, role }));
  } catch {
    /* noop */
  }
}

function getIdentity(): { user_id: string | null; role: string | null } {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return { user_id: null, role: null };
    const p = JSON.parse(raw);
    return { user_id: p?.user_id ?? null, role: p?.role ?? null };
  } catch {
    return { user_id: null, role: null };
  }
}

// ─── Session ID ──────────────────────────────────────────────────────────────
export function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `sid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return `sid_anon_${Date.now()}`;
  }
}

// ─── Sanitização ─────────────────────────────────────────────────────────────
const SENSITIVE_KEYS = new Set([
  "email", "cpf", "telefone", "whatsapp", "phone", "nome", "name",
]);
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_DIGITS_RE = /\b\d{11,}\b/g;

function sanitizeUrl(input: string): string {
  try {
    const u = new URL(input, "https://placeholder.invalid");
    const params = u.searchParams;
    const keys = Array.from(params.keys());
    for (const key of keys) {
      const lk = key.toLowerCase();
      const values = params.getAll(key);
      params.delete(key);
      for (const v of values) {
        const looksSensitive =
          SENSITIVE_KEYS.has(lk) ||
          EMAIL_RE.test(v) ||
          LONG_DIGITS_RE.test(v);
        // reset lastIndex em regex global
        EMAIL_RE.lastIndex = 0;
        LONG_DIGITS_RE.lastIndex = 0;
        params.append(key, looksSensitive ? "***" : v);
      }
    }
    // Reconstrói preservando origem real se a URL era absoluta
    if (input.startsWith("http")) {
      return `${u.origin}${u.pathname}${u.search}`;
    }
    return `${u.pathname}${u.search}`;
  } catch {
    return input.split("?")[0];
  }
}

function sanitizeMessage(msg: string | undefined | null): string | null {
  if (!msg) return null;
  return msg.replace(EMAIL_RE, "***").replace(LONG_DIGITS_RE, "***");
}

// ─── Construção da row ───────────────────────────────────────────────────────
function buildRow(ctx: NetworkFailureContext): TelemetryRow {
  const id = getIdentity();
  const conn = (navigator as any).connection?.effectiveType ?? null;
  return {
    user_id: id.user_id,
    profile_role: id.role,
    url: sanitizeUrl(ctx.url),
    method: ctx.method ?? null,
    error_name: ctx.error_name ?? null,
    error_message: sanitizeMessage(ctx.error_message ?? null),
    duration_ms: typeof ctx.duration_ms === "number" ? Math.round(ctx.duration_ms) : null,
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    connection_type: conn,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    origin_host: typeof location !== "undefined" ? location.host : "",
    retry_count: ctx.retry_count ?? 0,
    cf_ray: ctx.cf_ray ?? null,
    session_id: getSessionId(),
  };
}

// ─── Envio ───────────────────────────────────────────────────────────────────
async function sendRows(rows: TelemetryRow[]): Promise<boolean> {
  if (!SUPABASE_KEY || !originalFetch) return false;
  try {
    // Token de auth (best-effort, não bloqueia)
    let bearer = SUPABASE_KEY;
    try {
      // procura sb-*-auth-token no localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const p = JSON.parse(raw);
            const tok = p?.access_token || p?.currentSession?.access_token;
            if (tok) { bearer = tok; break; }
          }
        }
      }
    } catch { /* noop */ }

    const res = await originalFetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${bearer}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(rows),
      credentials: "omit",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

function pushPending(row: TelemetryRow) {
  try {
    const arr: TelemetryRow[] = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "[]");
    arr.push(row);
    while (arr.length > MAX_PENDING) arr.shift();
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(arr));
  } catch { /* noop */ }
}

async function drainPending() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const arr: TelemetryRow[] = JSON.parse(raw);
    if (!arr.length) return;
    const ok = await sendRows(arr);
    if (ok) sessionStorage.removeItem(PENDING_KEY);
  } catch { /* noop */ }
}

export function logNetworkFailure(ctx: NetworkFailureContext): void {
  // Anti-loop: nunca loga chamadas para a própria tabela
  if (ctx.url.includes(TELEMETRY_PATH_FRAGMENT)) return;
  const row = buildRow(ctx);
  // fire-and-forget
  void (async () => {
    const ok = await sendRows([row]);
    if (!ok) {
      pushPending(row);
    } else {
      // se enviou bem, tenta drenar pendentes
      void drainPending();
    }
  })();
}

// Drena pendentes ao voltar online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void drainPending(); });
}

// Marcador de uso (evita warning unused)
void SUPABASE_URL;
