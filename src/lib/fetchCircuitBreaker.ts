/**
 * Smart fetch — retry simples para o host Supabase canônico.
 *
 * Runtime 15/05/2026 v4 — DIRETO ÚNICO:
 *  - Sem failover de host. Sem reescrita de URL. Sem flip em localStorage.
 *  - Apenas retry com backoff em 5xx (300ms, 800ms) e timeout de 15s.
 *  - 4xx propaga normalmente (request chegou ao servidor).
 *  - TypeError/network errors propagam — quem chama decide o que fazer.
 *  - NUNCA derruba sessão. NUNCA dispara reload.
 */

import { recordFailure, recordSuccess } from "./apiHealth";

const MONITORED_HOSTNAME = "hunbxqzhvuemgntklyzb.supabase.co";
const RETRY_DELAYS_MS = [300, 800];
const REQUEST_TIMEOUT_MS = 15_000;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url;
}

function isMonitored(url: string): boolean {
  try {
    return new URL(url, window.location.href).hostname === MONITORED_HOSTNAME;
  } catch {
    return false;
  }
}

function withTimeout(init: RequestInit | undefined, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("Timeout", "AbortError")), ms);
  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) ctrl.abort();
    else callerSignal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  return {
    init: { ...(init || {}), signal: ctrl.signal },
    cleanup: () => clearTimeout(timer),
  };
}

export function installFetchCircuitBreaker() {
  if (typeof window === "undefined" || (window as any).__smartFetchInstalled) return;
  (window as any).__smartFetchInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!isMonitored(urlOf(input))) return originalFetch(input, init);

    let attempt = 0;
    let lastErr: unknown;

    while (attempt <= RETRY_DELAYS_MS.length) {
      const { init: timedInit, cleanup } = withTimeout(init, REQUEST_TIMEOUT_MS);
      try {
        const res = await originalFetch(input, timedInit);
        cleanup();

        if (res.status < 500) {
          if (res.ok) recordSuccess();
          return res;
        }

        // 5xx → retry no MESMO host com backoff
        recordFailure();
        lastErr = new Error(`HTTP ${res.status}`);
      } catch (err) {
        cleanup();
        lastErr = err;
        recordFailure();
      }

      if (attempt >= RETRY_DELAYS_MS.length) break;
      const delay = RETRY_DELAYS_MS[attempt];
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }

    throw lastErr instanceof Error ? lastErr : new Error("smart-fetch: unknown error");
  };
}
