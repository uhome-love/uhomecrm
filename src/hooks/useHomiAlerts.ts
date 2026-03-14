import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHomi } from "@/contexts/HomiContext";

const POLL_INTERVAL = 60_000; // 1 minute

/**
 * Polls homi_alerts for the current user and feeds them into HomiContext.
 * Only active alerts (not dismissed) from the last 24h are fetched.
 */
export function useHomiAlerts() {
  const { user } = useAuth();
  const { addProactiveAlert, alerts: existingAlerts } = useHomi();
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

      const alerts = (data || []) as Array<{
        id: string; tipo: string; prioridade: string; mensagem: string; contexto: any; created_at: string;
      }>;

      for (const alert of alerts) {
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

    // Initial fetch
    fetchAlerts();

    // Poll
    intervalRef.current = setInterval(fetchAlerts, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, fetchAlerts]);

  // Sync dismissals back to DB
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

function buildActions(tipo: string, contexto: any, dbAlertId: string) {
  const actions: { label: string; action: () => void }[] = [];

  switch (tipo) {
    case "leads_sem_contato":
    case "lead_stuck_stage":
      if (contexto?.lead_id) {
        actions.push({
          label: "Ver lead",
          action: () => {
            window.location.href = `/pipeline?lead=${contexto.lead_id}`;
          },
        });
      }
      break;
    case "visita_sem_confirmacao":
      actions.push({
        label: "Ver visitas",
        action: () => {
          window.location.href = "/visitas";
        },
      });
      break;
    case "corretor_inativo":
      actions.push({
        label: "Ver equipe",
        action: () => {
          window.location.href = "/equipe";
        },
      });
      break;
    case "tarefa_vencida":
      if (contexto?.pipeline_lead_id) {
        actions.push({
          label: "Ver tarefa",
          action: () => {
            window.location.href = `/pipeline?lead=${contexto.pipeline_lead_id}`;
          },
        });
      }
      break;
  }

  return actions;
}
