import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface User {
  id: string;
  email?: string;
  [key: string]: any;
}

interface Session {
  access_token: string;
  refresh_token: string;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const recoveryTimeoutRef = useRef<number | null>(null);

  const applySession = useCallback((nextSession: Session | null) => {
    if (recoveryTimeoutRef.current) {
      window.clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }

    sessionRef.current = nextSession;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Defensive boot: if local Supabase auth tokens are corrupted (malformed JSON,
    // wrong project ref, or "sub claim missing"-type payloads), purge them so the
    // app can show /auth instead of looping in "Failed to fetch".
    const purgeCorruptedAuthStorage = () => {
      try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith("sb-") || k.includes("supabase.auth"))) keys.push(k);
        }
        for (const k of keys) {
          try {
            const raw = localStorage.getItem(k);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
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
                  localStorage.removeItem(k);
                }
              } else {
                localStorage.removeItem(k);
              }
            }
          } catch {
            // unparseable token storage → remove
            try { localStorage.removeItem(k); } catch {}
          }
        }
      } catch {
        // ignore
      }
    };

    purgeCorruptedAuthStorage();

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

    const getSessionWithRetry = async (attempts = 3): Promise<any> => {
      let lastErr: any = null;
      for (let i = 1; i <= attempts; i++) {
        try {
          const { data, error } = await (supabase.auth as any).getSession();
          if (error) {
            const msg = String(error?.message || "");
            // Token rejected by server → drop local session de verdade (global)
            if (isFatalAuthError(msg)) {
              try {
                const { recordFatalAuthError } = await import("@/lib/authHealthMonitor");
                recordFatalAuthError(msg);
              } catch {}
              try { await (supabase.auth as any).signOut({ scope: "global" }); } catch {
                try { await (supabase.auth as any).signOut({ scope: "local" }); } catch {}
              }
              purgeCorruptedAuthStorage();
              return null;
            }
            throw error;
          }
          return data?.session ?? null;
        } catch (err: any) {
          lastErr = err;
          const msg = String(err?.message || "");
          const isNetwork = msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("network");
          if (!isNetwork || i === attempts) throw err;
          await new Promise((r) => setTimeout(r, i === 1 ? 500 : 1200));
        }
      }
      throw lastErr;
    };

    const recoverSession = async (graceful = false) => {
      try {
        const recoveredSession = await getSessionWithRetry();
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
              const retriedSession = await getSessionWithRetry(2);
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

        // Network/transient errors must NEVER drop an existing session.
        // Only confirmed auth errors (bad_jwt, missing sub) clear it,
        // and those are already handled inside getSessionWithRetry.
        const msg = String(err?.message || "");
        const isNetwork = msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("network");

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

      void recoverSession(true);
    });

    void recoverSession(false);

    return () => {
      isMounted = false;
      if (recoveryTimeoutRef.current) {
        window.clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
      }
      subscription.unsubscribe();
    };
  }, [applySession]);

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
        const { error } = await (supabase.auth as any).signInWithPassword({ email, password });
        if (!error) return { error: null };
        const msg = String(error?.message || "");
        const isNetwork = msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("network");
        if (!isNetwork || attempt === MAX_ATTEMPTS) return { error };
        lastError = error;
      } catch (err: any) {
        const msg = String(err?.message || "");
        const isNetwork = msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("network");
        if (!isNetwork || attempt === MAX_ATTEMPTS) {
          return { error: err ?? new Error("Erro inesperado ao entrar.") };
        }
        lastError = err;
      }
      // Exponential backoff: 600ms, 1500ms
      await new Promise((r) => setTimeout(r, attempt === 1 ? 600 : 1500));
    }
    return { error: lastError ?? new Error("Falha de conexão. Tente novamente.") };
  }, []);

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
