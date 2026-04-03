import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PendingLead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  empreendimento: string | null;
  origem: string | null;
  observacoes: string | null;
  aceite_expira_em: string | null;
  distribuido_em: string | null;
  prioridade_lead: string;
}

export function usePendingLeadAlert() {
  const { user } = useAuth();
  const [pendingLead, setPendingLead] = useState<PendingLead | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const checkPending = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone, email, empreendimento, origem, observacoes, aceite_expira_em, distribuido_em, prioridade_lead")
      .eq("corretor_id", user.id)
      .in("aceite_status", ["pendente", "aguardando_aceite"])
      .gt("aceite_expira_em", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (data) {
      setPendingLead(data as PendingLead);
      setShowDialog(true);
    } else {
      setPendingLead(null);
      setShowDialog(false);
    }
  }, [user]);

  // Initial check
  useEffect(() => {
    checkPending();
  }, [checkPending]);

  // Realtime subscription for new leads assigned to this user
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("my-pending-leads")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "pipeline_leads",
        filter: `corretor_id=eq.${user.id}`,
      }, () => {
        checkPending();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, checkPending]);

  // Poll every 15s as backup
  useEffect(() => {
    const iv = setInterval(checkPending, 30_000);
    return () => clearInterval(iv);
  }, [checkPending]);

  return {
    pendingLead,
    showDialog,
    closeDialog: () => setShowDialog(false),
    refresh: checkPending,
  };
}
