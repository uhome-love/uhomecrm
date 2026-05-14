/**
 * Global fetch monitor (non-destructive).
 *
 * Tracks sustained network failures against Supabase but does NOT purge
 * auth or force a reload — that behavior was causing cascading logouts
 * during normal transient blips ("volta e cai" symptom seen on 13/05/2026).
 *
 * Recovery is now handled exclusively in `useAuth` (only on confirmed
 * `bad_jwt` / `missing sub` errors). This module only logs telemetry so
 * we can spot real outages without nuking active sessions.
 */

import { recordFailure, recordSuccess } from "./apiHealth";

const WINDOW_MS = 60_000;
const LOG_THRESHOLD = 8;
const LOG_COOLDOWN_MS = 60_000;

let failures: number[] = [];
let lastLog = 0;

function isSupabaseUrl(input: RequestInfo | URL): boolean {
  try {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    return (
      url.includes(".supabase.co") ||
      url.includes("supabase.in") ||
      url.includes("api.uhomesales.com") ||
      url.includes("realtime.uhomesales.com")
    );
  } catch {
    return false;
  }
}

export function installFetchCircuitBreaker() {
  if (typeof window === "undefined" || (window as any).__cbInstalled) return;
  (window as any).__cbInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const res = await originalFetch(input, init);
      if (isSupabaseUrl(input) && res.ok) failures = [];
      return res;
    } catch (err) {
      if (isSupabaseUrl(input)) {
        const now = Date.now();
        failures = failures.filter((t) => now - t < WINDOW_MS);
        failures.push(now);
        if (failures.length >= LOG_THRESHOLD && now - lastLog > LOG_COOLDOWN_MS) {
          lastLog = now;
          // eslint-disable-next-line no-console
          console.warn(
            `[fetch-monitor] ${failures.length} Supabase fetch failures in last ${WINDOW_MS / 1000}s — backend may be flaky`,
          );
        }
      }
      throw err;
    }
  };
}
