// Fire-and-forget client → server telemetry sink for auth events.
// NEVER throws. NEVER blocks. Errors are silently swallowed.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const BUILD_HASH =
  (import.meta.env.VITE_BUILD_HASH as string | undefined) ||
  (import.meta.env.MODE as string | undefined) ||
  "unknown";

const SESSION_KEY = "auth_telemetry_session_id";

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `sid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "no-session-storage";
  }
}

export type AuthTelemetryEventType =
  | "purge_removed"
  | "purge_kept"
  | "refresh_start"
  | "refresh_success"
  | "refresh_failed"
  | "transition";

export interface AuthTelemetryPayload {
  event_type: AuthTelemetryEventType;
  user_id?: string | null;
  origin?: string | null;
  reason?: string | null;
  raw_len?: number | null;
  storage_key?: string | null;
  extra?: Record<string, unknown> | null;
}

export function sendAuthTelemetry(payload: AuthTelemetryPayload): void {
  try {
    if (!SUPABASE_URL) return;
    const body = JSON.stringify({
      ...payload,
      session_id: getSessionId(),
      build_hash: BUILD_HASH,
    });
    const url = `${SUPABASE_URL}/functions/v1/log-auth-event`;
    // keepalive ensures the request survives page transitions / unloads
    void fetch(url, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...(SUPABASE_ANON ? { apikey: SUPABASE_ANON } : {}),
      },
      body,
    }).catch(() => {
      /* swallow */
    });
  } catch {
    /* swallow */
  }
}
