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
    interesse: row.interesse || "",
    origem: row.origem || "",
    ultimoContato: row.ultimo_contato
      ? new Date(row.ultimo_contato).toLocaleDateString("pt-BR")
      : "",
    status: row.status || "",
    prioridade: row.prioridade as Lead["prioridade"],
    mensagemGerada: row.mensagem_gerada || undefined,
    recoveryScore: row.recovery_score ?? undefined,
    imovel: row.imovel_data ? (row.imovel_data as Lead["imovel"]) : undefined,
    corretor: undefined,
    etapa: undefined,
    dataCriacao: row.importado_em || "",
  };
  if (!lead.recoveryScore) {
    lead.recoveryScore = calculateRecoveryScore(lead);
  }
  return lead;
}

function parseDate(str: string): string | null {
  if (!str) return null;
  // Try dd/mm/yyyy
  const parts = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (parts) {
    const [, d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Try yyyy-mm-dd or ISO
  const iso = new Date(str);
  if (!isNaN(iso.getTime())) return iso.toISOString().split("T")[0];
  return null;
}

export function useLeadsPersistence() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLeads, setHasLeads] = useState(false);

  // Load leads from DB on mount
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadLeads();
  }, [user]);

  const loadLeads = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", user.id)
        .order("importado_em", { ascending: false });
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

  // Save leads to DB (batch upsert)
  const saveLeads = useCallback(async (newLeads: Lead[]): Promise<Lead[]> => {
    if (!user) return newLeads;
    try {
      const rows = newLeads.map((l) => ({
        user_id: user.id,
        nome: l.nome,
        email: l.email || null,
        telefone: l.telefone || null,
        interesse: l.interesse || null,
        origem: l.origem || null,
        ultimo_contato: parseDate(l.ultimoContato),
        status: l.status || null,
        recovery_score: l.recoveryScore ?? null,
        imovel_codigo: l.imovel?.codigo || null,
        imovel_data: l.imovel ? (l.imovel as any) : null,
        mensagem_gerada: l.mensagemGerada || null,
      }));

      // Insert in batches of 100
      const saved: any[] = [];
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { data, error } = await supabase
          .from("leads")
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

  // Update a single lead in DB
  const updateLead = useCallback(async (leadId: string, updates: Partial<Lead>) => {
    if (!user) return;
    const dbUpdates: any = {};
    if (updates.mensagemGerada !== undefined) dbUpdates.mensagem_gerada = updates.mensagemGerada;
    if (updates.prioridade !== undefined) {
      // Map frontend priority to DB enum
      const prioMap: Record<string, string> = {
        muito_quente: "alta", quente: "alta", morno: "media", frio: "frio", perdido: "perdido",
      };
      dbUpdates.prioridade = prioMap[updates.prioridade] || "media";
    }
    if (updates.recoveryScore !== undefined) dbUpdates.recovery_score = updates.recoveryScore;

    if (Object.keys(dbUpdates).length > 0) {
      dbUpdates.atualizado_em = new Date().toISOString();
      await supabase.from("leads").update(dbUpdates).eq("id", leadId).eq("user_id", user.id);
    }

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, ...updates } : l))
    );
  }, [user]);

  // Delete all leads
  const deleteAllLeads = useCallback(async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("leads").delete().eq("user_id", user.id);
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
