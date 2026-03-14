import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHomi } from "@/contexts/HomiContext";

const POLL_INTERVAL = 60_000; // 1 minute

/**
 * Polls homi_alerts for the current user and feeds them into HomiContext.
 * Handles both aggregated (broker-level) and individual alerts.
 */
export function useHomiAlerts() {
  const { user } = useAuth();
  const { addProactiveAlert } = useHomi();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from("homi_alerts")
        .select("id, tipo, prioridade, mensagem, contexto, created_at")
        .eq("destinatario_id", user.id)
        .eq("dispensada", false)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.warn("[useHomiAlerts] Fetch error:", error.message);
        return;
      }

      for (const alert of (data || []) as AlertRow[]) {
        if (seenIdsRef.current.has(alert.id)) continue;
        seenIdsRef.current.add(alert.id);

        addProactiveAlert({
          priority: alert.prioridade as "critical" | "normal" | "info",
          message: alert.mensagem,
          actions: buildActions(alert.tipo, alert.contexto, alert.id),
          ttl: 30_000,
        });
      }
    } catch (e) {
      console.warn("[useHomiAlerts] Error:", e);
    }
  }, [user, addProactiveAlert]);

  useEffect(() => {
    if (!user) return;
    fetchAlerts();
    intervalRef.current = setInterval(fetchAlerts, POLL_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user, fetchAlerts]);

  const dismissInDb = useCallback(async (alertDbId: string) => {
    try {
      await (supabase as any)
        .from("homi_alerts")
        .update({ dispensada: true })
        .eq("id", alertDbId);
    } catch (e) {
      console.warn("[useHomiAlerts] Dismiss error:", e);
    }
  }, []);

  return { dismissInDb };
}

interface AlertRow {
  id: string;
  tipo: string;
  prioridade: string;
  mensagem: string;
  contexto: any;
  created_at: string;
}

function buildActions(tipo: string, ctx: any, _dbAlertId: string) {
  const actions: { label: string; action: () => void }[] = [];

  switch (tipo) {
    // Aggregated alerts → navigate to pipeline filtered by broker
    case "leads_sem_contato":
    case "lead_stuck_stage":
      if (ctx?.corretor_id) {
        actions.push({
          label: `Ver leads (${ctx.count || "?"})`,
          action: () => { window.location.href = `/pipeline?corretor=${ctx.corretor_id}`; },
        });
      }
      break;

    // Individual visit alerts
    case "visita_sem_confirmacao":
      actions.push({
        label: "Ver visitas",
        action: () => { window.location.href = "/visitas"; },
      });
      if (ctx?.corretor_id) {
        actions.push({
          label: "Ver corretor",
          action: () => { window.location.href = `/pipeline?corretor=${ctx.corretor_id}`; },
        });
      }
      break;

    // Individual inactivity alerts
    case "corretor_inativo":
      actions.push({
        label: `Ver leads (${ctx?.pending_leads || "?"})`,
        action: () => { window.location.href = `/pipeline?corretor=${ctx?.corretor_id}`; },
      });
      break;

    // Aggregated task alerts
    case "tarefa_vencida":
      if (ctx?.corretor_id) {
        actions.push({
          label: `Ver tarefas (${ctx.count || "?"})`,
          action: () => { window.location.href = `/pipeline?corretor=${ctx.corretor_id}`; },
        });
      }
      break;
  }

  return actions;
}
