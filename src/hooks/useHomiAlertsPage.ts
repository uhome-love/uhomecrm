import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface HomiAlertRow {
  id: string;
  tipo: string;
  prioridade: string;
  mensagem: string;
  contexto: any;
  created_at: string;
  dispensada: boolean;
  lida: boolean;
}

export type AlertFilter = {
  prioridade?: string;
  tipo?: string;
  corretor_id?: string;
  gerente_nome?: string;
  showDismissed?: boolean;
};

export function useHomiAlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<HomiAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("homi_alerts")
        .select("id, tipo, prioridade, mensagem, contexto, created_at, dispensada, lida")
        .eq("destinatario_id", user.id)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.warn("[useHomiAlertsPage] Error:", error.message);
        return;
      }
      setAlerts(data || []);
      setUnreadCount((data || []).filter((a: HomiAlertRow) => !a.lida && !a.dispensada).length);
    } catch (e) {
      console.warn("[useHomiAlertsPage] Error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const dismissAlert = useCallback(async (alertId: string) => {
    try {
      await (supabase as any)
        .from("homi_alerts")
        .update({ dispensada: true })
        .eq("id", alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, dispensada: true } : a));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.warn("[useHomiAlertsPage] Dismiss error:", e);
    }
  }, []);

  const markAsRead = useCallback(async (alertId: string) => {
    try {
      await (supabase as any)
        .from("homi_alerts")
        .update({ lida: true })
        .eq("id", alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, lida: true } : a));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.warn("[useHomiAlertsPage] Mark read error:", e);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    try {
      await (supabase as any)
        .from("homi_alerts")
        .update({ lida: true })
        .eq("destinatario_id", user.id)
        .eq("lida", false);
      setAlerts(prev => prev.map(a => ({ ...a, lida: true })));
      setUnreadCount(0);
    } catch (e) {
      console.warn("[useHomiAlertsPage] Mark all read error:", e);
    }
  }, [user]);

  const dismissAll = useCallback(async () => {
    if (!user) return;
    try {
      await (supabase as any)
        .from("homi_alerts")
        .update({ dispensada: true })
        .eq("destinatario_id", user.id)
        .eq("dispensada", false);
      setAlerts(prev => prev.map(a => ({ ...a, dispensada: true })));
      setUnreadCount(0);
    } catch (e) {
      console.warn("[useHomiAlertsPage] Dismiss all error:", e);
    }
  }, [user]);

  return { alerts, loading, unreadCount, fetchAlerts, dismissAlert, markAsRead, markAllAsRead, dismissAll };
}
