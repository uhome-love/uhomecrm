/**
 * Auth Health Monitor
 *
 * Tracks fatal auth errors (bad_jwt, missing sub, session_not_found) over a
 * rolling window. If we see a spike (>=3 in 60s), we emit a console.warn so
 * it shows up in the Lovable console snapshot, allowing us to detect
 * GoTrue-side recycle events from the client side without backend access.
 */

const WINDOW_MS = 60_000;
const SPIKE_THRESHOLD = 3;

const events: number[] = [];
let lastWarnAt = 0;

export function recordFatalAuthError(reason: string) {
  const now = Date.now();
  // prune old events
  while (events.length && now - events[0] > WINDOW_MS) events.shift();
  events.push(now);

  if (events.length >= SPIKE_THRESHOLD && now - lastWarnAt > WINDOW_MS) {
    lastWarnAt = now;
    // Visible in console + sentry-ready signal
    console.warn(
      `[auth-health] SPIKE detected: ${events.length} fatal auth errors in last 60s. Last reason: ${reason}. ` +
        `Likely GoTrue recycle or stale tokens. Forcing clean logout.`
    );
    try {
      // soft signal for any external listeners (analytics)
      window.dispatchEvent(new CustomEvent("auth-health:spike", { detail: { count: events.length, reason } }));
    } catch {}
  }
}

export function getAuthHealthSnapshot() {
  const now = Date.now();
  const recent = events.filter((t) => now - t <= WINDOW_MS);
  return { recentFatalCount: recent.length, windowMs: WINDOW_MS };
}
