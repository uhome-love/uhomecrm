// Wrapper Supabase com failover bidirecional automático.
//
// Arquitetura (15/05/2026):
//   - Há DOIS hosts candidatos: `proxy` (api.uhomesales.com) e `direct`
//     (hunbxqzhvuemgntklyzb.supabase.co).
//   - Quem decide qual está ativo é o módulo `hostFailover`. Ele lê localStorage
//     no boot, e o `fetchCircuitBreaker` troca em runtime quando há falha de DNS.
//   - Realtime escuta `host:flipped` e reconecta no novo host.
//
// IMPORTANTE: NÃO importar do client.ts oficial — ele é auto-gerado pelo Lovable.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  getCurrentApiBase,
  getCurrentRealtimeUrl,
  getApiBaseFor,
  getRealtimeUrlFor,
  getPinnedHost,
} from "@/lib/hostFailover";

const SUPABASE_URL = getCurrentApiBase();
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

// ─── Realtime: aplica host atual + reconecta no flip ─────────────────────────
function applyRealtimeEndpoint() {
  const url = getCurrentRealtimeUrl();
  try {
    (supabase.realtime as any).endPoint = url;
    (supabase.realtime as any).endPointURL = () => url;
  } catch {
    // noop
  }
}

applyRealtimeEndpoint();

if (typeof window !== "undefined") {
  // Quando o circuit breaker trocar de host, reaplica endpoint e reconecta
  window.addEventListener("host:flipped", () => {
    applyRealtimeEndpoint();
    try {
      const rt: any = supabase.realtime;
      if (typeof rt.disconnect === "function") rt.disconnect();
      if (typeof rt.connect === "function") setTimeout(() => rt.connect(), 250);
    } catch {
      // noop
    }
  });

  // Watchdog dedicado: se o WebSocket falhar repetidamente no host atual,
  // tenta reconectar no host alternativo (sem trocar o pinned global, que é
  // responsabilidade do circuit breaker via fetch).
  let wsFailures = 0;
  const WS_FAILURE_THRESHOLD = 3;
  const onError = () => {
    wsFailures++;
    if (wsFailures >= WS_FAILURE_THRESHOLD) {
      wsFailures = 0;
      const altHost = getPinnedHost() === "proxy" ? "direct" : "proxy";
      const altUrl = getRealtimeUrlFor(altHost);
      try {
        (supabase.realtime as any).endPoint = altUrl;
        (supabase.realtime as any).endPointURL = () => altUrl;
        (supabase.realtime as any).disconnect?.();
        setTimeout(() => (supabase.realtime as any).connect?.(), 250);
        console.warn(`[realtime] WS failover: reconnecting on ${altHost}`);
      } catch {
        // noop
      }
    }
  };
  try {
    (supabase.realtime as any).onError?.(onError);
  } catch {
    // noop
  }
}

// ─── Wrapper observador de telemetria (NÃO substitui o circuit breaker) ─────
if (typeof window !== "undefined" && !(window as any).__netTelemetryWrapped) {
  (window as any).__netTelemetryWrapped = true;
  const inner = window.fetch.bind(window);
  // Monitora ambos os hosts conhecidos
  const MONITORED = /(\.uhomesales\.com|hunbxqzhvuemgntklyzb\.supabase\.co)$/i;

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
