/**
 * Global fetch circuit breaker.
 *
 * Detects sustained "Failed to fetch" / network errors against Supabase and,
 * after N consecutive failures, purges corrupted auth storage and forces a
 * clean reload. Prevents the "CRM doesn't load anymore" loop seen on
 * 13/05/2026 when stale PWA + corrupted JWT caused infinite fetch failures.
 */

const FAILURE_THRESHOLD = 5;
const WINDOW_MS = 30_000;
const COOLDOWN_MS = 60_000;

let failures: number[] = [];
let lastTrip = 0;

function purgeAuthStorage() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("sb-") || k.includes("supabase.auth"))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

function trip(reason: string) {
  const now = Date.now();
  if (now - lastTrip < COOLDOWN_MS) return;
  lastTrip = now;
  // eslint-disable-next-line no-console
  console.error("[CircuitBreaker] tripped:", reason, "→ purge + reload");
  purgeAuthStorage();
  const url = new URL(window.location.href);
  url.searchParams.set("_cb", String(now));
  window.location.replace(url.toString());
}

function isSupabaseUrl(input: RequestInfo | URL): boolean {
  try {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    return url.includes(".supabase.co") || url.includes("supabase.in");
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
      // Reset on success against Supabase
      if (isSupabaseUrl(input) && res.ok) failures = [];
      return res;
    } catch (err) {
      if (isSupabaseUrl(input)) {
        const now = Date.now();
        failures = failures.filter((t) => now - t < WINDOW_MS);
        failures.push(now);
        if (failures.length >= FAILURE_THRESHOLD) {
          trip(`${failures.length} fetch failures in ${WINDOW_MS}ms`);
        }
      }
      throw err;
    }
  };
}
