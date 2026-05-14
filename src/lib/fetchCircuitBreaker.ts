/**
 * Smart fetch — retry com backoff exponencial e failover automático
 * primary (api.uhomesales.com) → backup (api-backup.uhomesales.com).
 *
 * Comportamento:
 *  - Intercepta apenas requests para hosts uhomesales.com.
 *  - Em TypeError ("Failed to fetch"), timeout >15s ou 5xx → retry com
 *    backoff (300ms, 800ms, 2s).
 *  - Após 2 falhas consecutivas em <30s, marca sticky no backup
 *    (sessionStorage) e reescreve o host em todas as próximas requests.
 *  - Probe automático de retorno ao primary a cada 5min via /__health.
 *  - NUNCA derruba sessão. NUNCA dispara reload. Apenas telemetria + retry.
 *
 * Em ambientes onde NÃO faz sentido fazer failover (ex: dentro do iframe
 * do preview do Lovable, onde o proxy lovable.js intercepta o fetch e
 * gera Failed to fetch independente do backend), o failover fica
 * desabilitado — só telemetria.
 */

import { recordFailure, recordSuccess } from "./apiHealth";
import {
  PRIMARY,
  BACKUP,
  getActiveTarget,
  setActiveTarget,
  type ProxyTarget,
} from "./proxyEndpoints";

// ─── Config ──────────────────────────────────────────────────────────────────
const RETRY_DELAYS_MS = [300, 800, 2000];
const REQUEST_TIMEOUT_MS = 15_000;
const FAILURE_WINDOW_MS = 30_000;
const FAILURE_THRESHOLD_FOR_SWITCH = 2;
const PROBE_INTERVAL_MS = 5 * 60_000;
const STICKY_BACKUP_TTL_MS = 30 * 60_000;

const PRIMARY_HOST = new URL(PRIMARY.api).hostname; // api.uhomesales.com
const BACKUP_HOST = new URL(BACKUP.api).hostname;   // api-backup.uhomesales.com

// ─── Estado ──────────────────────────────────────────────────────────────────
let failures: number[] = [];
let stickyBackupUntil = 0;

function isOwnHost(url: string): boolean {
  try {
    const u = new URL(url, window.location.href);
    return u.hostname === PRIMARY_HOST || u.hostname === BACKUP_HOST;
  } catch {
    return false;
  }
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url;
}

/** Reescreve para o host de backup se o sticky estiver ativo. */
function applyTargetRewrite(input: RequestInfo | URL): RequestInfo | URL {
  const target = currentTarget();
  if (target !== "backup") return input;
  try {
    const original = urlOf(input);
    const u = new URL(original, window.location.href);
    if (u.hostname === PRIMARY_HOST) {
      u.hostname = BACKUP_HOST;
      // Mantém Request com headers/body se for o caso
      if (typeof input === "string" || input instanceof URL) return u.toString();
      return new Request(u.toString(), input as Request);
    }
  } catch {
    // noop
  }
  return input;
}

function currentTarget(): ProxyTarget {
  // Expira sticky
  if (stickyBackupUntil && Date.now() > stickyBackupUntil) {
    stickyBackupUntil = 0;
    setActiveTarget("primary");
  }
  return getActiveTarget();
}

function shouldFailoverEnabled(): boolean {
  // Failover habilitado em TODOS os ambientes (incluindo preview do Lovable).
  // Quando api.uhomesales.com falhar, tentamos api-backup.uhomesales.com.
  return true;
}

function switchToBackup(reason: string) {
  if (!shouldFailoverEnabled()) return;
  if (currentTarget() === "backup") return;
  setActiveTarget("backup");
  stickyBackupUntil = Date.now() + STICKY_BACKUP_TTL_MS;
  // eslint-disable-next-line no-console
  console.warn(`[smart-fetch] Switching to BACKUP host (reason: ${reason})`);
  void logSwitch("backup", reason);
}

function switchToPrimary(reason: string) {
  if (currentTarget() === "primary") return;
  setActiveTarget("primary");
  stickyBackupUntil = 0;
  failures = [];
  // eslint-disable-next-line no-console
  console.info(`[smart-fetch] Switched back to PRIMARY (reason: ${reason})`);
  void logSwitch("primary", reason);
}

async function logSwitch(target: ProxyTarget, reason: string) {
  // Telemetria silenciosa (best-effort) — usa o próprio fetch nativo já
  // capturado em closure no install para evitar loop.
  try {
    const payload = {
      target,
      reason,
      ts: new Date().toISOString(),
      ua: navigator.userAgent,
      host: window.location.hostname,
    };
    // Salva localmente para inspeção via /diagnostico-rede
    const KEY = "uhome:proxy:switches";
    const log: any[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    log.unshift(payload);
    localStorage.setItem(KEY, JSON.stringify(log.slice(0, 50)));
  } catch {
    // noop
  }
}

function recordRetryableFailure() {
  const now = Date.now();
  failures = failures.filter((t) => now - t < FAILURE_WINDOW_MS);
  failures.push(now);
  if (failures.length >= FAILURE_THRESHOLD_FOR_SWITCH) {
    switchToBackup("repeated_failures");
  }
}

// ─── Probe de retorno ao primary ─────────────────────────────────────────────
async function probePrimary(originalFetch: typeof fetch) {
  if (currentTarget() !== "backup") return;
  if (!shouldFailoverEnabled()) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await originalFetch(`${PRIMARY.api}/__health`, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.ok) switchToPrimary("primary_recovered");
  } catch {
    // primary continua fora — mantém backup
  }
}

// ─── Helper de timeout ───────────────────────────────────────────────────────
function withTimeout(init: RequestInit | undefined, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("Timeout", "AbortError")), ms);
  // Compõe com o signal do caller, se houver
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

// ─── Install ─────────────────────────────────────────────────────────────────
export function installFetchCircuitBreaker() {
  if (typeof window === "undefined" || (window as any).__smartFetchInstalled) return;
  (window as any).__smartFetchInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const targetUrl = urlOf(input);
    const monitored = isOwnHost(targetUrl);

    // Não-monitorado: passa direto, sem instrumentação
    if (!monitored) return originalFetch(input, init);

    // Aplica reescrita primary→backup se sticky ativo
    let rewritten: RequestInfo | URL = applyTargetRewrite(input);

    let attempt = 0;
    let lastErr: unknown;

    // attempt 0 é a tentativa original; até length(RETRY_DELAYS_MS) retries
    while (attempt <= RETRY_DELAYS_MS.length) {
      const { init: timedInit, cleanup } = withTimeout(init, REQUEST_TIMEOUT_MS);
      try {
        const res = await originalFetch(rewritten, timedInit);
        cleanup();

        if (res.ok) {
          if (failures.length) failures = [];
          recordSuccess();
          return res;
        }

        // 4xx (exceto 502/503/504) é "rede ok" — não vale retry
        if (res.status < 500) {
          recordSuccess();
          return res;
        }

        // 5xx → conta falha, vai pro retry
        recordFailure();
        recordRetryableFailure();
        lastErr = new Error(`HTTP ${res.status}`);
      } catch (err) {
        cleanup();
        // Erro de rede / timeout → conta como falha
        recordFailure();
        recordRetryableFailure();
        lastErr = err;
      }

      // Esgotou retries → propaga
      if (attempt >= RETRY_DELAYS_MS.length) break;

      // Aguarda backoff e tenta de novo (já com possível switch ao backup
      // aplicado por recordRetryableFailure)
      const delay = RETRY_DELAYS_MS[attempt];
      await new Promise((r) => setTimeout(r, delay));
      attempt++;

      // Reaplica reescrita se o switch ocorreu durante o wait
      rewritten = applyTargetRewrite(input);
    }

    throw lastErr instanceof Error ? lastErr : new Error("smart-fetch: unknown error");
  };

  // Probe de recuperação do primary a cada 5min
  if (shouldFailoverEnabled()) {
    setInterval(() => void probePrimary(originalFetch), PROBE_INTERVAL_MS);
    // Probe extra quando a aba volta a ficar visível
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void probePrimary(originalFetch);
    });
  }
}
