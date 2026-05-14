import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/customClient";
import { sendAuthTelemetry } from "@/lib/authTelemetry";

interface User {
  id: string;
  email?: string;
  [key: string]: any;
}

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: User;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isFatalAuthError = (msg: string) =>
  msg.includes("missing sub") ||
  msg.includes("invalid claim") ||
  msg.includes("bad_jwt") ||
  msg.includes("JWT expired") ||
  msg.includes("Invalid Refresh Token") ||
  msg.includes("Session not found") ||
  msg.includes("session_not_found") ||
  msg.includes("Refresh Token Not Found") ||
  msg.includes("User from sub claim in JWT does not exist");

const isNetworkLikeError = (msg: string) =>
  msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("network");

const isSessionNearExpiry = (currentSession: Session | null, marginSec = 90) => {
  const expiresAt = currentSession?.expires_at;
  if (typeof expiresAt !== "number") return false;
  return expiresAt - Math.floor(Date.now() / 1000) <= marginSec;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const recoveryTimeoutRef = useRef<number | null>(null);

  const purgeCorruptedAuthStorage = useCallback((origin: string = "unknown") => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("sb-") || k.includes("supabase.auth"))) keys.push(k);
      }
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const rawLen = raw.length;
        let parsed: any = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          // C1.b: parse-fail transitório — NÃO remover. Apenas logar.
          // Storage pode estar mid-write em iOS PWA / Safari.
          console.warn(
            `[auth-purge] parse_fail (kept) key=${k} rawLen=${rawLen} origin=${origin}`,
          );
          sendAuthTelemetry({
            event_type: "purge_kept",
            origin,
            reason: "parse_fail",
            raw_len: rawLen,
            storage_key: k,
          });
          continue;
        }
        try {
          const token = parsed?.access_token || parsed?.currentSession?.access_token;
          if (token && typeof token === "string") {
            const parts = token.split(".");
            if (parts.length === 3) {
              const payload = JSON.parse(
                atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
              );
              const nowSec = Math.floor(Date.now() / 1000);
              const expired = typeof payload?.exp === "number" && payload.exp < nowSec - 5;
              if (!payload?.sub || expired) {
                const reason = !payload?.sub ? "missing_sub" : "expired";
                console.warn(
                  `[auth-purge] removed key=${k} rawLen=${rawLen} reason=${reason} origin=${origin}`,
                );
                sendAuthTelemetry({
                  event_type: "purge_removed",
                  user_id: typeof payload?.sub === "string" ? payload.sub : null,
                  origin,
                  reason,
                  raw_len: rawLen,
                  storage_key: k,
                });
                localStorage.removeItem(k);
              }
            } else if (rawLen > 0) {
              // Token claramente malformado (não é JWT)
              console.warn(
                `[auth-purge] removed key=${k} rawLen=${rawLen} reason=parts_${parts.length} origin=${origin}`,
              );
              sendAuthTelemetry({
                event_type: "purge_removed",
                origin,
                reason: `parts_${parts.length}`,
                raw_len: rawLen,
                storage_key: k,
              });
              localStorage.removeItem(k);
            }
          }
        } catch (innerErr) {
          // Erro ao decodificar JWT — não remover, apenas logar
          console.warn(
            `[auth-purge] jwt_decode_fail (kept) key=${k} rawLen=${rawLen} origin=${origin}`,
          );
          sendAuthTelemetry({
            event_type: "purge_kept",
            origin,
            reason: "jwt_decode_fail",
            raw_len: rawLen,
            storage_key: k,
            extra: { error: String((innerErr as any)?.message || innerErr) },
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const applySession = useCallback((nextSession: Session | null) => {
    if (recoveryTimeoutRef.current) {
      window.clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }

    // C2.a: log SIGNED_IN → SIGNED_OUT transitions com stack trace
    const prevUserId = sessionRef.current?.user?.id ?? null;
    const nextUserId = nextSession?.user?.id ?? null;
    if (prevUserId && !nextUserId) {
      const stack = new Error("transition_trace").stack;
      console.warn(
        `[auth-transition] SIGNED_IN → SIGNED_OUT prevUser=${prevUserId}\n${stack}`,
      );
      sendAuthTelemetry({
        event_type: "transition",
        user_id: prevUserId,
        origin: "applySession",
        reason: "signed_in_to_signed_out",
        extra: { stack: stack?.slice(0, 4000) ?? null },
      });
    }

    sessionRef.current = nextSession;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setLoading(false);
  }, []);

  const getSessionWithRetry = useCallback(async (attempts = 3, origin: string = "getSession"): Promise<Session | null> => {
    let lastErr: any = null;
    for (let i = 1; i <= attempts; i++) {
      try {
        const { data, error } = await (supabase.auth as any).getSession();
        if (error) {
          const msg = String(error?.message || "");
          if (isFatalAuthError(msg)) {
            // C2.c: log refresh attempt
            try {
              console.warn(`[auth-refresh] start origin=${origin}:fatal-getSession reason="${msg}"`);
              sendAuthTelemetry({ event_type: "refresh_start", origin: `${origin}:fatal-getSession`, reason: msg });
              const { data: refreshed, error: refreshError } = await (supabase.auth as any).refreshSession();
              if (!refreshError && refreshed?.session?.user) {
                console.warn(`[auth-refresh] success origin=${origin}:fatal-getSession`);
                sendAuthTelemetry({
                  event_type: "refresh_success",
                  origin: `${origin}:fatal-getSession`,
                  user_id: refreshed.session.user.id,
                });
                return refreshed.session as Session;
              }
              console.warn(`[auth-refresh] failed origin=${origin}:fatal-getSession err="${refreshError?.message || "no-session"}"`);
              sendAuthTelemetry({
                event_type: "refresh_failed",
                origin: `${origin}:fatal-getSession`,
                reason: refreshError?.message || "no-session",
              });
            } catch (refreshErr: any) {
              console.warn(`[auth-refresh] threw origin=${origin}:fatal-getSession err="${refreshErr?.message || refreshErr}"`);
              sendAuthTelemetry({
                event_type: "refresh_failed",
                origin: `${origin}:fatal-getSession`,
                reason: "threw",
                extra: { error: String(refreshErr?.message || refreshErr) },
              });
            }
            try {
              const { recordFatalAuthError } = await import("@/lib/authHealthMonitor");
              recordFatalAuthError(msg);
            } catch {}
            purgeCorruptedAuthStorage(`getSessionWithRetry:${origin}`);
            return null;
          }
          throw error;
        }
        return (data?.session as Session | null) ?? null;
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || "");
        if (!isNetworkLikeError(msg) || i === attempts) throw err;
        await new Promise((r) => setTimeout(r, i === 1 ? 500 : 1200));
      }
    }
    throw lastErr;
  }, [purgeCorruptedAuthStorage]);

  const refreshSessionSafely = useCallback(async (origin: string = "unknown"): Promise<Session | null> => {
    // C2.c: log every refresh with origin
    console.warn(`[auth-refresh] start origin=${origin}`);
    sendAuthTelemetry({ event_type: "refresh_start", origin });
    try {
      const { data, error } = await (supabase.auth as any).refreshSession();
      if (error) throw error;
      const next = (data?.session as Session | null) ?? null;
      console.warn(`[auth-refresh] success origin=${origin} hasUser=${!!next?.user}`);
      sendAuthTelemetry({
        event_type: "refresh_success",
        origin,
        user_id: next?.user?.id ?? null,
        extra: { hasUser: !!next?.user },
      });
      return next;
    } catch (err: any) {
      const msg = String(err?.message || "");
      console.warn(`[auth-refresh] failed origin=${origin} err="${msg}"`);
      sendAuthTelemetry({ event_type: "refresh_failed", origin, reason: msg });
      if (isFatalAuthError(msg)) {
        try {
          const { recordFatalAuthError } = await import("@/lib/authHealthMonitor");
          recordFatalAuthError(msg);
        } catch {}
        purgeCorruptedAuthStorage(`refreshSessionSafely:${origin}`);
        return null;
      }
      throw err;
    }
  }, [purgeCorruptedAuthStorage]);

  const waitForFreshSession = useCallback(async (timeoutMs = 5000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const nextSession = await getSessionWithRetry(1).catch(() => null);
      if (nextSession?.user) {
        applySession(nextSession);
        return nextSession;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  }, [applySession, getSessionWithRetry]);

  useEffect(() => {
    let isMounted = true;

    purgeCorruptedAuthStorage("boot");

    // Safety ceiling: nunca deixar o app preso em "loading" mais que 8s no boot.
    // Se chegar aqui E a API estiver offline, NÃO purga storage — apenas libera a UI
    // mantendo a sessão local; o ApiOfflineBanner avisa o usuário.
    const bootTimeout = window.setTimeout(async () => {
      if (!isMounted) return;
      if (sessionRef.current?.user) return; // já temos sessão válida
      let apiOffline = false;
      try {
        const { getApiHealth } = await import("@/lib/apiHealth");
        apiOffline = getApiHealth() !== "online";
      } catch { /* noop */ }
      if (apiOffline) {
        console.warn("[auth-boot] ceiling reached but API offline — keeping local session, unblocking UI");
        sendAuthTelemetry({ event_type: "transition", origin: "boot_ceiling", reason: "api_offline_kept_session" });
        setLoading(false);
        return;
      }
      console.warn("[auth-boot] ceiling reached (8s) without session — purging and unblocking UI");
      sendAuthTelemetry({ event_type: "transition", origin: "boot_ceiling", reason: "loading_timeout" });
      try { purgeCorruptedAuthStorage("boot_ceiling"); } catch {}
      applySession(null);
    }, 8000);

    const recoverSession = async (graceful = false) => {
      try {
        let recoveredSession = await getSessionWithRetry();

        if (!recoveredSession?.user && sessionRef.current?.refresh_token) {
          recoveredSession = await refreshSessionSafely("recoverSession:no-session").catch(() => null);
        } else if (recoveredSession?.user && isSessionNearExpiry(recoveredSession)) {
          const refreshedSession = await refreshSessionSafely("near_expiry").catch(() => null);
          if (refreshedSession?.user) recoveredSession = refreshedSession;
        }

        if (!isMounted) return;

        if (recoveredSession?.user) {
          applySession(recoveredSession);
          return;
        }

        if (graceful && sessionRef.current?.user) {
          if (recoveryTimeoutRef.current) return;
          recoveryTimeoutRef.current = window.setTimeout(async () => {
            recoveryTimeoutRef.current = null;
            try {
              let retriedSession = await getSessionWithRetry(2, "recoverSession:retry");
              if (!retriedSession?.user && sessionRef.current?.refresh_token) {
                retriedSession = await refreshSessionSafely("recoverSession:retry").catch(() => null);
              }
              if (!isMounted) return;
              applySession(retriedSession ?? null);
            } catch {
              if (!isMounted) return;
              applySession(null);
            }
          }, 1500);
          setLoading(false);
          return;
        }

        applySession(null);
      } catch (err: any) {
        if (!isMounted) return;

        const msg = String(err?.message || "");
        const isNetwork = isNetworkLikeError(msg);
        const isFatal = isFatalAuthError(msg);

        // Erro fatal de auth (missing sub, bad_jwt, refresh_token inválido):
        // limpar storage corrompido e devolver para tela de login imediatamente.
        if (isFatal) {
          console.warn(`[auth-boot] fatal error during recover: ${msg}`);
          sendAuthTelemetry({ event_type: "transition", origin: "boot_fatal", reason: msg });
          try { purgeCorruptedAuthStorage("boot_fatal"); } catch {}
          applySession(null);
          return;
        }

        // Network/transient: preservar sessão atual (se houver) só se já válida.
        if ((graceful || isNetwork) && sessionRef.current?.user) {
          setLoading(false);
          return;
        }

        applySession(null);
      }
    };

    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((event: string, nextSession: any) => {
      if (!isMounted) return;

      if (nextSession?.user) {
        applySession(nextSession);
        return;
      }

      if (event === "SIGNED_OUT") {
        applySession(null);
        return;
      }

      if ((event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") && sessionRef.current?.user) {
        setLoading(false);
        return;
      }

      void recoverSession(true);
    });

    void recoverSession(false);

    return () => {
      isMounted = false;
      window.clearTimeout(bootTimeout);
      if (recoveryTimeoutRef.current) {
        window.clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
      }
      subscription.unsubscribe();
    };
  }, [applySession, getSessionWithRetry, purgeCorruptedAuthStorage, refreshSessionSafely]);

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      if (!sessionRef.current?.refresh_token) return;
      // Não martelar refresh quando a API está offline — gera cascata de "Failed to fetch".
      try {
        const { getApiHealth } = await import("@/lib/apiHealth");
        if (getApiHealth() === "offline") return;
      } catch { /* noop */ }
      void refreshSessionSafely("visibility")
        .then((nextSession) => {
          if (nextSession?.user) applySession(nextSession);
        })
        .catch(() => undefined);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [applySession, refreshSessionSafely]);

  const signUp = useCallback(async (email: string, password: string, nome: string) => {
    const { error } = await (supabase.auth as any).signUp({
      email,
      password,
      options: {
        data: { nome },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    // Retry signInWithPassword on transient network errors ("Failed to fetch")
    // which happen during Supabase auth cold starts / restarts.
    const MAX_ATTEMPTS = 3;
    let lastError: any = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { data, error } = await (supabase.auth as any).signInWithPassword({ email, password });
        if (!error && data?.session?.user) {
          applySession(data.session as Session);
          return { error: null };
        }
        if (!error) {
          const recoveredSession = await waitForFreshSession();
          if (recoveredSession?.user) return { error: null };
        }
        if (!error) return { error: null };
        const msg = String(error?.message || "");
        const isNetwork = isNetworkLikeError(msg);
        if (!isNetwork || attempt === MAX_ATTEMPTS) return { error };
        lastError = error;
      } catch (err: any) {
        const msg = String(err?.message || "");
        const isNetwork = isNetworkLikeError(msg);
        if (!isNetwork || attempt === MAX_ATTEMPTS) {
          return { error: err ?? new Error("Erro inesperado ao entrar.") };
        }
        lastError = err;
      }
      // Exponential backoff: 600ms, 1500ms
      await new Promise((r) => setTimeout(r, attempt === 1 ? 600 : 1500));
    }
    return { error: lastError ?? new Error("Falha de conexão. Tente novamente.") };
  }, [applySession, waitForFreshSession]);

  const signOut = useCallback(async () => {
    await (supabase.auth as any).signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
