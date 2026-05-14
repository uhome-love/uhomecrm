// Detector global de saúde da API uhomesales.com.
// Estados: online | degraded | offline.
// Atualizado pelo fetchCircuitBreaker via recordFailure/recordSuccess.

import { useSyncExternalStore } from "react";

export type ApiHealth = "online" | "degraded" | "offline";

const WINDOW_MS = 30_000;
const DEGRADED_THRESHOLD = 2; // ≥2 falhas em 30s
const OFFLINE_THRESHOLD = 5;  // ≥5 falhas em 30s

let failures: number[] = [];
let successes: number[] = [];
let current: ApiHealth = "online";
const listeners = new Set<() => void>();

function prune(now: number) {
  failures = failures.filter((t) => now - t < WINDOW_MS);
  successes = successes.filter((t) => now - t < WINDOW_MS);
}

function recompute() {
  const now = Date.now();
  prune(now);
  let next: ApiHealth = "online";
  if (failures.length >= OFFLINE_THRESHOLD && successes.length === 0) next = "offline";
  else if (failures.length >= DEGRADED_THRESHOLD) next = "degraded";
  if (next !== current) {
    current = next;
    listeners.forEach((l) => {
      try { l(); } catch { /* noop */ }
    });
    try {
      window.dispatchEvent(new CustomEvent("api-health:changed", { detail: { state: next } }));
    } catch {
      // noop
    }
  }
}

export function recordFailure() {
  failures.push(Date.now());
  recompute();
}

export function recordSuccess() {
  successes.push(Date.now());
  // Recovery rápido: sucesso limpa boa parte das falhas
  if (successes.length >= 2) failures = [];
  recompute();
}

export function getApiHealth(): ApiHealth {
  return current;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useApiHealth(): ApiHealth {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
    () => current,
    () => "online" as ApiHealth,
  );
}
