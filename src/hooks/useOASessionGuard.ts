import { useState, useEffect, useCallback } from "react";

// ─── BroadcastChannel-based session guard ───
// Prevents two tabs from running the dialer simultaneously
const CHANNEL_NAME = "oa-dialer-session";
const SESSION_KEY = "oa_active_session";

function generateSessionId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useOASessionGuard() {
  const [sessionId] = useState(() => generateSessionId());
  const [blocked, setBlocked] = useState(false);
  const [otherSessionActive, setOtherSessionActive] = useState(false);

  useEffect(() => {
    // Check if another session exists
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && existing !== sessionId) {
      // Another tab is active in THIS browser window context
      // sessionStorage is per-tab, so we use BroadcastChannel instead
    }

    // Register this session
    sessionStorage.setItem(SESSION_KEY, sessionId);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);

      // Announce presence
      channel.postMessage({ type: "session_active", sessionId });

      channel.onmessage = (event) => {
        const msg = event.data;
        if (msg.type === "session_active" && msg.sessionId !== sessionId) {
          setOtherSessionActive(true);
        }
        if (msg.type === "session_claimed" && msg.sessionId !== sessionId) {
          // Another tab claimed the session — we should block
          setBlocked(true);
        }
        if (msg.type === "session_ping") {
          // Respond to ping
          channel?.postMessage({ type: "session_active", sessionId });
        }
        if (msg.type === "session_closed" && msg.sessionId !== sessionId) {
          setOtherSessionActive(false);
          setBlocked(false);
        }
      };
    } catch {
      // BroadcastChannel not supported — skip guard
    }

    return () => {
      try {
        channel?.postMessage({ type: "session_closed", sessionId });
        channel?.close();
      } catch {}
      sessionStorage.removeItem(SESSION_KEY);
    };
  }, [sessionId]);

  // Claim this session (force other tabs to yield)
  const claimSession = useCallback(() => {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type: "session_claimed", sessionId });
      channel.close();
    } catch {}
    setBlocked(false);
    setOtherSessionActive(false);
  }, [sessionId]);

  return { sessionId, blocked, otherSessionActive, claimSession };
}
