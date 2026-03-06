import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

export interface Visita {
  id: string;
  corretor_id: string;
  gerente_id: string;
  lead_id: string | null;
  nome_cliente: string;
  telefone: string | null;
  empreendimento: string | null;
  origem: string;
  origem_detalhe: string | null;
  data_visita: string;
  hora_visita: string | null;
  local_visita: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  linked_attempt_id: string | null;
}

export type VisitaStatus = "marcada" | "confirmada" | "realizada" | "reagendada" | "cancelada" | "no_show";
export type VisitaOrigem = "oferta_ativa" | "whatsapp" | "crm" | "pdn" | "manual" | "indicacao" | "reativacao" | "outro";

export const STATUS_LABELS: Record<string, string> = {
  marcada: "Marcada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  reagendada: "Reagendada",
  cancelada: "Cancelada",
  no_show: "No Show",
};

export const STATUS_COLORS: Record<string, string> = {
  marcada: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  confirmada: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  realizada: "bg-green-600/10 text-green-700 border-green-600/30",
  reagendada: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  cancelada: "bg-red-500/10 text-red-600 border-red-500/30",
  no_show: "bg-gray-500/10 text-gray-600 border-gray-500/30",
};

export const ORIGEM_LABELS: Record<string, string> = {
  oferta_ativa: "Oferta Ativa",
  whatsapp: "WhatsApp",
  crm: "CRM",
  pdn: "PDN",
  manual: "Manual",
  indicacao: "Indicação",
  reativacao: "Reativação",
  outro: "Outro",
};

export function useVisitas(filters?: {
  status?: string;
  corretorId?: string;
  empreendimento?: string;
  startDate?: string;
  endDate?: string;
}) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ["visitas", filters, user?.id, isAdmin],
    queryFn: async () => {
      let q = supabase
        .from("visitas")
        .select("*")
        .order("data_visita", { ascending: false })
        .order("hora_visita", { ascending: true });

      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.corretorId) q = q.eq("corretor_id", filters.corretorId);
      if (filters?.empreendimento) q = q.eq("empreendimento", filters.empreendimento);
      if (filters?.startDate) q = q.gte("data_visita", filters.startDate);
      if (filters?.endDate) q = q.lte("data_visita", filters.endDate);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Visita[];
    },
    enabled: !!user,
  });

  const createVisita = useCallback(async (visita: Partial<Visita>) => {
    if (!user) return null;

    // Resolve gerente_id from team_members
    let gerenteId = visita.gerente_id;
    if (!gerenteId) {
      const { data: tm } = await supabase
        .from("team_members")
        .select("gerente_id")
        .eq("user_id", visita.corretor_id || user.id)
        .eq("status", "ativo")
        .limit(1)
        .maybeSingle();
      gerenteId = tm?.gerente_id || user.id;
    }

    const { data, error } = await supabase
      .from("visitas")
      .insert({
        corretor_id: visita.corretor_id || user.id,
        gerente_id: gerenteId,
        lead_id: visita.lead_id || null,
        nome_cliente: visita.nome_cliente || "Sem nome",
        telefone: visita.telefone || null,
        empreendimento: visita.empreendimento || null,
        origem: visita.origem || "manual",
        origem_detalhe: visita.origem_detalhe || null,
        data_visita: visita.data_visita || new Date().toISOString().split("T")[0],
        hora_visita: visita.hora_visita || null,
        local_visita: visita.local_visita || null,
        status: visita.status || "marcada",
        observacoes: visita.observacoes || null,
        created_by: user.id,
        linked_attempt_id: visita.linked_attempt_id || null,
      } as any)
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar visita:", error);
      toast.error("Erro ao criar visita");
      return null;
    }

    queryClient.invalidateQueries({ queryKey: ["visitas"] });
    toast.success("📅 Visita registrada com sucesso!");
    return data;
  }, [user, queryClient]);

  const updateVisita = useCallback(async (id: string, updates: Partial<Visita>) => {
    const { error } = await supabase
      .from("visitas")
      .update(updates as any)
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar visita");
      return false;
    }

    queryClient.invalidateQueries({ queryKey: ["visitas"] });
    toast.success("Visita atualizada!");
    return true;
  }, [queryClient]);

  const updateStatus = useCallback(async (id: string, newStatus: VisitaStatus) => {
    return updateVisita(id, { status: newStatus } as any);
  }, [updateVisita]);

  return { visitas, isLoading, createVisita, updateVisita, updateStatus };
}

// Helper to create visita from OA attempt
export async function createVisitaFromOA(params: {
  corretorId: string;
  leadId?: string;
  nomeCliente: string;
  telefone?: string;
  empreendimento?: string;
  attemptId?: string;
  observacoes?: string;
}) {
  // Resolve gerente_id
  const { data: tm } = await supabase
    .from("team_members")
    .select("gerente_id")
    .eq("user_id", params.corretorId)
    .eq("status", "ativo")
    .limit(1)
    .maybeSingle();

  const gerenteId = tm?.gerente_id || params.corretorId;

  const { data, error } = await supabase
    .from("visitas")
    .insert({
      corretor_id: params.corretorId,
      gerente_id: gerenteId,
      lead_id: params.leadId || null,
      nome_cliente: params.nomeCliente,
      telefone: params.telefone || null,
      empreendimento: params.empreendimento || null,
      origem: "oferta_ativa",
      data_visita: new Date().toISOString().split("T")[0],
      status: "marcada",
      observacoes: params.observacoes || null,
      created_by: params.corretorId,
      linked_attempt_id: params.attemptId || null,
    } as any)
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar visita automática:", error);
  }
  return data;
}
