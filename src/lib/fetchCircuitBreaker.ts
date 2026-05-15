/**
 * Smart fetch — failover bidirecional automático entre `proxy` e `direct`.
 *
 * Comportamento (15/05/2026):
 *  - Intercepta requests para qualquer host conhecido (api.uhomesales.com OU
 *    hunbxqzhvuemgntklyzb.supabase.co).
 *  - Garante que toda request saia no host atualmente pinado (corrige drift).
 *  - Em TypeError ("Failed to fetch"/"Load failed"/DNS) ou timeout >15s:
 *      1) Retenta a MESMA request no host alternativo imediatamente.
 *      2) Se o alternativo responder (qualquer status HTTP, mesmo 4xx) → flipa
 *         o pinned host em localStorage e segue. Próximas requests já vão direto
 *         no host bom.
 *      3) Se o alternativo também falhar com erro de rede → backoff e retry no
 *         host original.
 *  - 5xx faz retry com backoff (300ms, 800ms) no MESMO host.
 *  - NUNCA derruba sessão. NUNCA dispara reload.
 */

import { recordFailure, recordSuccess } from "./apiHealth";
import {
  getPinnedHost,
  getAlternateHost,
  flipHost,
  rewriteUrlToHost,
  identifyHost,
  type HostId,
} from "./hostFailover";

// ─── Config ──────────────────────────────────────────────────────────────────
const RETRY_DELAYS_MS = [300, 800];
const REQUEST_TIMEOUT_MS = 15_000;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url, window.location.href).hostname;
  } catch {
    return "";
  }
}

/** Reescreve a request para o host pinado atual (corrige drift). */
function rewriteToCurrentHost(input: RequestInfo | URL): RequestInfo | URL {
  try {
    const original = urlOf(input);
    const u = new URL(original, window.location.href);
    const currentHost = identifyHost(u.hostname);
    const pinned = getPinnedHost();
    if (currentHost && currentHost !== pinned) {
      const newUrl = rewriteUrlToHost(u.toString(), pinned);
      if (typeof input === "string" || input instanceof URL) return newUrl;
      return new Request(newUrl, input as Request);
    }
  } catch {
    // noop
  }
  return input;
}

/** Reescreve a request para o host alternativo. */
function rewriteToHost(input: RequestInfo | URL, target: HostId): RequestInfo | URL {
  try {
    const original = urlOf(input);
    const newUrl = rewriteUrlToHost(original, target);
    if (newUrl === original) return input;
    if (typeof input === "string" || input instanceof URL) return newUrl;
    return new Request(newUrl, input as Request);
  } catch {
    return input;
  }
}

// ─── Helper de timeout ───────────────────────────────────────────────────────
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

/** Erro de rede/DNS (precisa de failover de host) vs erro HTTP (não precisa). */
function isNetworkLevelError(err: any): boolean {
  if (!err) return false;
  const name = String(err.name || "");
  const msg = String(err.message || "");
  return (
    name === "TypeError" ||
    name === "AbortError" ||
    /failed to fetch/i.test(msg) ||
    /load failed/i.test(msg) ||
    /networkerror/i.test(msg) ||
    /name.*not.*resolv/i.test(msg) ||
    /timeout/i.test(msg) ||
    /offline/i.test(msg)
  );
}

// ─── Install ─────────────────────────────────────────────────────────────────
export function installFetchCircuitBreaker() {
  if (typeof window === "undefined" || (window as any).__smartFetchInstalled) return;
  (window as any).__smartFetchInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const targetUrl = urlOf(input);
    const monitoredHost = identifyHost(hostnameOf(targetUrl));

    // Não-monitorado: passa direto
    if (!monitoredHost) return originalFetch(input, init);

    // Garante que sai no host pinado atual (corrige caso o supabase-js tenha
    // construído a URL com o host antigo antes do flip)
    let request: RequestInfo | URL = rewriteToCurrentHost(input);

    let attempt = 0;
    let lastErr: unknown;

    // attempt 0 = original; demais = retries no MESMO host (5xx)
    while (attempt <= RETRY_DELAYS_MS.length) {
      const { init: timedInit, cleanup } = withTimeout(init, REQUEST_TIMEOUT_MS);
      try {
        const res = await originalFetch(request, timedInit);
        cleanup();

        if (res.status < 500) {
          // 2xx, 3xx, 4xx — request chegou ao servidor; sucesso de rede
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

        // Erro de REDE/DNS → tenta o host alternativo IMEDIATAMENTE (1x)
        if (isNetworkLevelError(err)) {
          const pinned = getPinnedHost();
          const alt = getAlternateHost(pinned);
          const altRequest = rewriteToHost(input, alt);

          const { init: altInit, cleanup: altCleanup } = withTimeout(init, REQUEST_TIMEOUT_MS);
          try {
            const altRes = await originalFetch(altRequest, altInit);
            altCleanup();
            // Alternativo respondeu (qualquer status) → host bom encontrado
            flipHost(`fetch_failover_from_${pinned}`);
            recordSuccess();
            return altRes;
          } catch (altErr) {
            altCleanup();
            // Alternativo também falhou — não flipa, continua retry no original
            lastErr = altErr;
          }
        }
      }

      // Esgotou retries → propaga
      if (attempt >= RETRY_DELAYS_MS.length) break;

      const delay = RETRY_DELAYS_MS[attempt];
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
      // Reaplica reescrita (caso o pinned tenha mudado durante o wait)
      request = rewriteToCurrentHost(input);
    }

    throw lastErr instanceof Error ? lastErr : new Error("smart-fetch: unknown error");
  };
}
