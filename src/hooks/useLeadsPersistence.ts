import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { calculateRecoveryScore } from "@/lib/leadUtils";
import { toast } from "sonner";
import type { Lead } from "@/types/lead";

function dbRowToLead(row: any): Lead {
  const lead: Lead = {
    id: row.id,
    nome: row.nome,
    email: row.email || "",
    telefone: row.telefone || "",
    interesse: row.empreendimento || "",
    origem: row.origem || "",
    ultimoContato: row.updated_at
      ? new Date(row.updated_at).toLocaleDateString("pt-BR")
      : "",
    status: row.temperatura || "",
    prioridade: mapTemperaturaToPrority(row.temperatura),
    mensagemGerada: undefined,
    recoveryScore: undefined,
    imovel: undefined,
    corretor: undefined,
    etapa: undefined,
    dataCriacao: row.created_at || "",
    statusRecuperacao: "pendente",
    tipoSituacao: undefined,
    corretorResponsavel: row.corretor_id || undefined,
    observacoes: row.observacoes || undefined,
  };
  if (!lead.recoveryScore) {
    lead.recoveryScore = calculateRecoveryScore(lead);
  }
  return lead;
}

function mapTemperaturaToPrority(temp: string | null): Lead["prioridade"] {
  if (!temp) return "morno";
  const map: Record<string, Lead["prioridade"]> = {
    quente: "muito_quente",
    morno: "morno",
    frio: "frio",
  };
  return map[temp] || "morno";
}

function parseDate(str: string): string | null {
  if (!str) return null;
  const parts = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (parts) {
    const [, d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = new Date(str);
  if (!isNaN(iso.getTime())) return iso.toISOString().split("T")[0];
  return null;
}

export function useLeadsPersistence() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLeads, setHasLeads] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadLeads();
  }, [user]);

  const loadLeads = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pipeline_leads")
        .select("*")
        .eq("corretor_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const mapped = (data || []).map(dbRowToLead);
      setLeads(mapped);
      setHasLeads(mapped.length > 0);
    } catch (err) {
      console.error("Error loading leads:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveLeads = useCallback(async (newLeads: Lead[]): Promise<Lead[]> => {
    if (!user) return newLeads;
    try {
      // Get first stage for new leads
      const { data: stageData } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("tipo", "novo_lead")
        .limit(1)
        .single();
      const stageId = stageData?.id || "d3843b2f-2fa1-4c31-9129-4eb0ed21f019";

      const rows = newLeads.map((l) => ({
        nome: l.nome,
        email: l.email || null,
        telefone: l.telefone || null,
        empreendimento: l.interesse || null,
        origem: l.origem || null,
        temperatura: "frio" as const,
        stage_id: stageId,
        corretor_id: user.id,
        observacoes: l.observacoes || null,
        created_by: user.id,
      }));

      const saved: any[] = [];
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { data, error } = await supabase
          .from("pipeline_leads")
          .insert(batch)
          .select();
        if (error) throw error;
        if (data) saved.push(...data);
      }

      const mapped = saved.map(dbRowToLead);
      setLeads(mapped);
      setHasLeads(true);
      return mapped;
    } catch (err: any) {
      console.error("Error saving leads:", err);
      toast.error("Erro ao salvar leads no banco.");
      return newLeads;
    }
  }, [user]);

  const updateLead = useCallback(async (leadId: string, updates: Partial<Lead>) => {
    if (!user) return;
    const dbUpdates: any = {};
    if (updates.observacoes !== undefined) dbUpdates.observacoes = updates.observacoes;
    if (updates.prioridade !== undefined) {
      const tempMap: Record<string, string> = {
        muito_quente: "quente", quente: "quente", morno: "morno", frio: "frio", perdido: "frio",
      };
      dbUpdates.temperatura = tempMap[updates.prioridade] || "morno";
    }

    if (Object.keys(dbUpdates).length > 0) {
      dbUpdates.updated_at = new Date().toISOString();
      await supabase.from("pipeline_leads").update(dbUpdates).eq("id", leadId);
    }

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, ...updates } : l))
    );
  }, [user]);

  const deleteAllLeads = useCallback(async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("pipeline_leads").delete().eq("corretor_id", user.id);
      if (error) throw error;
      setLeads([]);
      setHasLeads(false);
      toast.success("Todos os leads foram removidos.");
    } catch {
      toast.error("Erro ao remover leads.");
    }
  }, [user]);

  return { leads, setLeads, loading, hasLeads, loadLeads, saveLeads, updateLead, deleteAllLeads };
}
