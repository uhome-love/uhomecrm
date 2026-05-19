/**
 * usePageTracking — instrumentação global de page views.
 *
 * Semântica de "session":
 *   Session = aba do navegador (escopo de sessionStorage).
 *   Um usuário com 3 abas conta 3 sessions distintos.
 *   Reload na mesma aba mantém o session_id; fechar/abrir aba cria novo.
 *
 * Estratégia:
 *   - Captura mudanças de rota via useLocation()
 *   - Debounce 300ms (ignora redirects rápidos)
 *   - Enfileira eventos; flush a cada 30s OU 10 eventos
 *   - Em beforeunload / visibilitychange(hidden): flush síncrono via
 *     fetch keepalive na RPC `flush_page_views` (carrega JWT)
 *   - duration_ms da rota anterior = (timestamp atual - timestamp da entrada)
 */

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { matchRoutePattern, isPublicRoute } from "@/lib/routePatterns";

const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_AT_COUNT = 10;
const DEBOUNCE_MS = 300;
const SESSION_KEY = "uhome:pv_sid";

type PendingInsert = {
  client_id: string; // ref interna p/ correlacionar duration_ms quando ainda na queue
  user_id: string;
  role: string;
  route: string;
  route_pattern: string;
  referrer_route: string | null;
  session_id: string;
  duration_ms: number | null;
  viewport_width: number | null;
  viewed_at: string;
};

type PendingUpdate = { id: string; duration_ms: number };

const insertQueue: PendingInsert[] = [];
const updateQueue: PendingUpdate[] = [];
let lastInsertedId: string | null = null; // id real (vindo do supabase) da última linha
let lastInsertedClientId: string | null = null;
let lastEnteredAt: number = 0;

function getSessionId(): string {
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return "no-storage";
  }
}

async function flushQueue(): Promise<void> {
  if (!insertQueue.length && !updateQueue.length) return;
  const inserts = insertQueue.splice(0, insertQueue.length);
  const updates = updateQueue.splice(0, updateQueue.length);

  try {
    if (inserts.length) {
      const { data, error } = await supabase
        .from("page_views")
        .insert(
          inserts.map(({ client_id: _ignored, ...row }) => row)
        )
        .select("id");
      if (!error && data?.length) {
        // Correlaciona última linha inserida para futuro UPDATE de duration_ms
        const lastRow = data[data.length - 1];
        const lastPending = inserts[inserts.length - 1];
        lastInsertedId = lastRow.id;
        lastInsertedClientId = lastPending.client_id;
      }
    }
    if (updates.length) {
      // UPDATE em massa: roda 1 por 1 (RLS impede operações em massa por id externo)
      await Promise.all(
        updates.map((u) =>
          supabase.from("page_views").update({ duration_ms: u.duration_ms }).eq("id", u.id)
        )
      );
    }
  } catch (err) {
    // best-effort — não logar ruído em produção
    console.warn("[usePageTracking] flush error", err);
  }
}

/** Flush síncrono via fetch keepalive (sobrevive a unload) usando RPC */
function beaconFlush(): void {
  if (!insertQueue.length && !updateQueue.length) return;
  const inserts = insertQueue.splice(0, insertQueue.length);
  const updates = updateQueue.splice(0, updateQueue.length);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!supabaseUrl || !apikey) return;

  // Pega token do storage local do supabase (formato sb-<projectRef>-auth-token)
  let accessToken = "";
  try {
    const projectRef = (supabaseUrl.match(/https:\/\/([^.]+)\./) ?? [])[1];
    const key = `sb-${projectRef}-auth-token`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      accessToken = parsed?.access_token ?? "";
    }
  } catch {
    /* noop */
  }
  if (!accessToken) return;

  const body = JSON.stringify({
    payload: {
      updates: updates.map((u) => ({ id: u.id, duration_ms: u.duration_ms })),
      inserts: inserts.map(({ client_id: _ignored, ...row }) => row),
    },
  });

  try {
    fetch(`${supabaseUrl}/rest/v1/rpc/flush_page_views`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey,
        Authorization: `Bearer ${accessToken}`,
      },
      body,
    }).catch(() => {});
  } catch {
    /* noop */
  }
}

export function usePageTracking(): void {
  const { user } = useAuth();
  const { roles } = useUserRole();
  const location = useLocation();
  const debounceRef = useRef<number | undefined>(undefined);
  const prevPathRef = useRef<string | null>(null);
  const flushTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    const pattern = matchRoutePattern(location.pathname);
    if (isPublicRoute(pattern)) return;

    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const now = Date.now();

      // Fecha duration_ms da rota anterior
      if (lastEnteredAt > 0) {
        const duration = now - lastEnteredAt;
        if (lastInsertedClientId) {
          // ainda na queue: muta o item
          const idx = insertQueue.findIndex((i) => i.client_id === lastInsertedClientId);
          if (idx >= 0) insertQueue[idx].duration_ms = duration;
          else if (lastInsertedId) updateQueue.push({ id: lastInsertedId, duration_ms: duration });
        } else if (lastInsertedId) {
          updateQueue.push({ id: lastInsertedId, duration_ms: duration });
        }
      }

      const clientId = crypto.randomUUID();
      insertQueue.push({
        client_id: clientId,
        user_id: user.id,
        role: roles?.[0] ?? "unknown",
        route: location.pathname,
        route_pattern: pattern,
        referrer_route: prevPathRef.current,
        session_id: getSessionId(),
        duration_ms: null,
        viewport_width: typeof window !== "undefined" ? window.innerWidth : null,
        viewed_at: new Date().toISOString(),
      });
      lastInsertedClientId = clientId;
      lastInsertedId = null; // resetado até o flush dar id real
      lastEnteredAt = now;
      prevPathRef.current = location.pathname;

      if (insertQueue.length >= FLUSH_AT_COUNT) void flushQueue();
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(debounceRef.current);
  }, [location.pathname, user?.id, roles]);

  useEffect(() => {
    if (!user) return;
    flushTimerRef.current = window.setInterval(() => void flushQueue(), FLUSH_INTERVAL_MS);
    const onUnload = () => beaconFlush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") beaconFlush();
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(flushTimerRef.current);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      void flushQueue();
    };
  }, [user?.id]);
}
