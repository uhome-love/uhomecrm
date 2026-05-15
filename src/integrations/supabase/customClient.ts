// Wrapper Supabase — DIRETO ÚNICO (Runtime 15/05/2026 v4).
//
// Todo o tráfego frontend vai direto para o host canônico do Supabase.
// Sem proxy próprio, sem failover, sem flip de host em localStorage.
// DNS Cloudflare (api.uhomesales.com) continua publicado para integrações
// server-side e diagnóstico, mas NÃO é usado em runtime do app.
//
// IMPORTANTE: NÃO importar do client.ts oficial — ele é auto-gerado pelo Lovable.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = "https://hunbxqzhvuemgntklyzb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      // Desabilita navigator.locks (bug "Lock broken by another request with the
      // 'steal' option" em PWA + múltiplas abas). No-op é seguro: pior caso, abas
      // fazem refresh redundante de token.
      lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  },
);

// ─── Wrapper observador de telemetria (NÃO substitui o circuit breaker) ─────
if (typeof window !== "undefined" && !(window as any).__netTelemetryWrapped) {
  (window as any).__netTelemetryWrapped = true;
  const inner = window.fetch.bind(window);
  const MONITORED = /hunbxqzhvuemgntklyzb\.supabase\.co$/i;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url = "";
    let method = init?.method || "GET";
    try {
      if (typeof input === "string") url = input;
      else if (input instanceof URL) url = input.toString();
      else { url = (input as Request).url; method = (input as Request).method || method; }
    } catch { /* noop */ }

    let monitored = false;
    try { monitored = MONITORED.test(new URL(url, window.location.href).hostname); } catch { /* noop */ }

    if (!monitored) return inner(input, init);

    const t0 = performance.now();
    try {
      const res = await inner(input, init);
      if (res.status >= 500) {
        const ray = res.headers.get("cf-ray");
        const dur = performance.now() - t0;
        queueMicrotask(() => {
          import("@/lib/networkTelemetry").then(({ logNetworkFailure }) => {
            logNetworkFailure({
              url, method, error_name: `HTTP_${res.status}`,
              error_message: `status ${res.status}`, duration_ms: dur,
              cf_ray: ray, retry_count: 0,
            });
          }).catch(() => undefined);
        });
      }
      return res;
    } catch (e: any) {
      const dur = performance.now() - t0;
      const name = String(e?.name || "Error");
      const message = String(e?.message || e || "unknown");
      queueMicrotask(() => {
        import("@/lib/networkTelemetry").then(({ logNetworkFailure }) => {
          logNetworkFailure({
            url, method, error_name: name, error_message: message,
            duration_ms: dur, cf_ray: null, retry_count: 0,
          });
        }).catch(() => undefined);
      });
      throw e;
    }
  };
}

// Identidade leve para a telemetria
if (typeof window !== "undefined") {
  (async () => {
    try {
      const { data } = await (supabase.auth as any).getSession();
      const uid = data?.session?.user?.id ?? null;
      if (uid) {
        const { setTelemetryIdentity } = await import("@/lib/networkTelemetry");
        setTelemetryIdentity(uid, null);
      }
    } catch { /* noop */ }
  })();

  (supabase.auth as any).onAuthStateChange?.(async (_evt: string, session: any) => {
    try {
      const { setTelemetryIdentity } = await import("@/lib/networkTelemetry");
      setTelemetryIdentity(session?.user?.id ?? null, null);
    } catch { /* noop */ }
  });
}
