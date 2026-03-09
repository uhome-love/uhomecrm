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
  pipeline_lead_id: string | null;
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
  linked_pdn_id: string | null;
  converted_to_pdn_at: string | null;
  converted_to_pdn_by: string | null;
  corretor_nome?: string;
  equipe?: string;
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
  lead: "Lead",
  network: "Network",
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
        .select("id, corretor_id, gerente_id, lead_id, pipeline_lead_id, nome_cliente, telefone, empreendimento, origem, origem_detalhe, data_visita, hora_visita, local_visita, status, observacoes, created_at, updated_at, created_by, linked_attempt_id, linked_pdn_id, converted_to_pdn_at, converted_to_pdn_by, resultado_visita")
        .order("data_visita", { ascending: true })
        .order("hora_visita", { ascending: true })
        .limit(500);

      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.corretorId) q = q.eq("corretor_id", filters.corretorId);
      if (filters?.empreendimento) q = q.eq("empreendimento", filters.empreendimento);
      if (filters?.startDate) q = q.gte("data_visita", filters.startDate);
      if (filters?.endDate) q = q.lte("data_visita", filters.endDate);

      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as Visita[];

      // Fetch corretor names for all unique corretor_ids
      const corretorIds = [...new Set(rows.map(r => r.corretor_id).filter(Boolean))];
      if (corretorIds.length > 0) {
        // Try profiles first
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", corretorIds);
        
        const nameMap = new Map((profiles || []).map(p => [p.user_id, p.nome]));

        // Fetch team_members for missing names + equipe
        const { data: members } = await supabase
          .from("team_members")
          .select("user_id, nome, equipe")
          .in("user_id", corretorIds)
          .eq("status", "ativo");

        const equipeMap = new Map<string, string>();
        (members || []).forEach(m => {
          if (m.user_id) {
            if (!nameMap.get(m.user_id)) nameMap.set(m.user_id, m.nome);
            if (m.equipe) equipeMap.set(m.user_id, m.equipe);
          }
        });

        // Fetch gerente names from gerente_id to derive team when equipe is missing
        const gerenteIds = [...new Set(rows.map(r => r.gerente_id).filter(Boolean))];
        const gerenteNameMap = new Map<string, string>();
        if (gerenteIds.length > 0) {
          const { data: gerenteProfiles } = await supabase
            .from("profiles")
            .select("user_id, nome")
            .in("user_id", gerenteIds);
          (gerenteProfiles || []).forEach(g => {
            if (g.user_id && g.nome) {
              gerenteNameMap.set(g.user_id, g.nome.split(" ")[0]);
            }
          });
        }

        rows.forEach(r => {
          r.corretor_nome = nameMap.get(r.corretor_id) || undefined;
          // Prefer equipe from team_members, fallback to gerente first name
          r.equipe = equipeMap.get(r.corretor_id) || (r.gerente_id ? gerenteNameMap.get(r.gerente_id) : undefined) || undefined;
        });
      }

      return rows;
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
        pipeline_lead_id: visita.pipeline_lead_id || null,
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

    // GATILHO 1: Auto-advance pipeline lead to "agenda" module
    if (data?.pipeline_lead_id) {
      try {
        await supabase.from("pipeline_leads").update({
          modulo_atual: "agenda",
        } as any).eq("id", data.pipeline_lead_id);

        await supabase.from("lead_progressao").insert({
          lead_id: data.pipeline_lead_id,
          modulo_origem: "pipeline",
          modulo_destino: "agenda",
          fase_destino: "visita_marcada",
          triggered_by: "agendar_visita",
          corretor_id: data.corretor_id,
          visita_id: data.id,
        });
      } catch (err) {
        console.error("Lead progression error:", err);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["visitas"] });

    // Send WhatsApp confirmation (fire-and-forget)
    if (data?.telefone) {
      supabase.functions.invoke("visita-whatsapp-confirm", {
        body: {
          action: "confirm",
          visita_data: {
            nome_cliente: data.nome_cliente,
            telefone: data.telefone,
            empreendimento: data.empreendimento,
            data_visita: data.data_visita,
            hora_visita: data.hora_visita,
            corretor_id: data.corretor_id,
            confirmation_token: (data as any).confirmation_token || null,
          },
        },
      }).then(({ error: whatsappError }) => {
        if (whatsappError) {
          console.warn("WhatsApp confirmation failed:", whatsappError);
        } else {
          toast.success("📱 Confirmação enviada por WhatsApp!", { duration: 3000 });
        }
      });
    }

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
    const result = await updateVisita(id, { status: newStatus } as any);
    
    // Auto-progression triggers based on visita status changes
    if (result) {
      const visita = visitas.find(v => v.id === id);
      if (visita?.pipeline_lead_id) {
        try {
          if (newStatus === "realizada") {
            // GATILHO 2: Create negocio + advance to negocios module
            const { data: negocio } = await supabase
              .from("negocios")
              .insert({
                lead_id: visita.pipeline_lead_id,
                visita_id: visita.id,
                corretor_id: visita.corretor_id,
                gerente_id: visita.gerente_id,
                nome_cliente: visita.nome_cliente,
                empreendimento: visita.empreendimento || null,
                telefone: visita.telefone || null,
                fase: "proposta",
                origem: "visita_realizada",
                pipeline_lead_id: visita.pipeline_lead_id,
              } as any)
              .select()
              .single();

            if (negocio) {
              await supabase.from("pipeline_leads").update({
                modulo_atual: "negocios",
                negocio_id: negocio.id,
              } as any).eq("id", visita.pipeline_lead_id);

              await supabase.from("lead_progressao").insert({
                lead_id: visita.pipeline_lead_id,
                modulo_origem: "agenda",
                modulo_destino: "negocios",
                fase_destino: "proposta",
                triggered_by: "visita_realizada",
                corretor_id: visita.corretor_id,
                visita_id: visita.id,
                negocio_id: negocio.id,
              });

              toast("🎉 Negócio criado automaticamente!", {
                description: "🎯 Envie a proposta em até 24h!",
                duration: 5000,
              });
            }
          } else if (newStatus === "no_show" || newStatus === "cancelada") {
            // GATILHO 4: Return to pipeline
            await supabase.from("pipeline_leads").update({
              modulo_atual: "pipeline",
            } as any).eq("id", visita.pipeline_lead_id);

            await supabase.from("lead_progressao").insert({
              lead_id: visita.pipeline_lead_id,
              modulo_origem: "agenda",
              modulo_destino: "pipeline",
              fase_destino: "qualificacao",
              triggered_by: newStatus,
              corretor_id: visita.corretor_id,
            });
          }
        } catch (err) {
          console.error("Lead progression error:", err);
        }
      }
    }
    
    return result;
  }, [updateVisita, visitas]);

  const deleteVisita = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("visitas")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir visita");
      return false;
    }

    queryClient.invalidateQueries({ queryKey: ["visitas"] });
    toast.success("Visita excluída!");
    return true;
  }, [queryClient]);

  return { visitas, isLoading, createVisita, updateVisita, updateStatus, deleteVisita };
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
