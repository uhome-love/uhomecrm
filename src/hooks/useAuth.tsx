import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode, type Context } from "react";
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

declare global {
  // eslint-disable-next-line no-var
  var __uhomeAuthContext__: Context<AuthContextType | undefined> | undefined;
}

const AuthContext = globalThis.__uhomeAuthContext__ ?? createContext<AuthContextType | undefined>(undefined);
if (!globalThis.__uhomeAuthContext__) {
  globalThis.__uhomeAuthContext__ = AuthContext;
}

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

  // Detecta JWT corrompido (bad_jwt / missing sub) chamando getUser().
  // Quando ocorre, limpamos storage e mandamos para /auth com flag de recuperação.
  // Isso impede o "limbo": sessão local presente mas inválida → telas vazias silenciosas.
  const handleBrokenSession = useCallback(async () => {
    try {
      console.warn("[useAuth] Sessão inválida (bad_jwt/missing sub) — limpando estado local e forçando re-login.");
      try { await (supabase.auth as any).signOut(); } catch {}
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
      try {
        const anyIDB: any = (window as any).indexedDB;
        if (anyIDB?.databases) {
          const dbs = await anyIDB.databases();
          dbs?.forEach((db: any) => db?.name && anyIDB.deleteDatabase(db.name));
        }
      } catch {}
    } finally {
      const url = new URL(window.location.origin + "/auth");
      url.searchParams.set("recovered", "1");
      window.location.replace(url.toString());
    }
  }, []);

  const probeSessionValid = useCallback(async () => {
    try {
      const { error } = await (supabase.auth as any).getUser();
      if (!error) return;
      const msg = String((error as any)?.message || "").toLowerCase();
      const code = String((error as any)?.code || "").toLowerCase();
      const broken =
        msg.includes("invalid claim") ||
        msg.includes("missing sub") ||
        msg.includes("bad_jwt") ||
        code === "bad_jwt" ||
        (msg.includes("jwt") && !msg.includes("expired"));
      if (broken) await handleBrokenSession();
    } catch {
      // erros de rede aqui não devem deslogar — só JWT inválido confirmado.
    }
  }, [handleBrokenSession]);

  useEffect(() => {
    let isMounted = true;

    const recoverSession = async (graceful = false) => {
      try {
        const { data: { session: recoveredSession } } = await (supabase.auth as any).getSession();
        if (!isMounted) return;

        if (recoveredSession?.user) {
          applySession(recoveredSession);
          void probeSessionValid();
          return;
        }

        if (graceful && sessionRef.current?.user) {
          if (recoveryTimeoutRef.current) return;
          recoveryTimeoutRef.current = window.setTimeout(async () => {
            recoveryTimeoutRef.current = null;
            try {
              const { data: { session: retriedSession } } = await (supabase.auth as any).getSession();
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
      } catch {
        if (!isMounted) return;
        if (graceful && sessionRef.current?.user) {
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
  }, [applySession, probeSessionValid]);

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
    const { error } = await (supabase.auth as any).signInWithPassword({ email, password });
    return { error };
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
