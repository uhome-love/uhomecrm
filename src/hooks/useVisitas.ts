import { useCallback } from "react";
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
  resultado_visita: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  linked_attempt_id: string | null;
  linked_pdn_id: string | null;
  converted_to_pdn_at: string | null;
  converted_to_pdn_by: string | null;
  corretor_nome?: string;
  equipe?: string;
  tipo?: string;
  negocio_id?: string | null;
  tipo_reuniao?: string | null;
  responsavel_visita?: string | null;
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;

interface CreateVisitaInput extends Partial<Visita> {
  responsavel_visita?: string | null;
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractUuid(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return UUID_REGEX.test(trimmed) ? trimmed : null;
  }

  if (value && typeof value === "object" && "id" in value) {
    const nested = (value as { id?: unknown }).id;
    if (typeof nested === "string") {
      const trimmed = nested.trim();
      return UUID_REGEX.test(trimmed) ? trimmed : null;
    }
  }

  return null;
}

function normalizeDateForDb(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (DATE_ONLY_REGEX.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTimeForDb(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!TIME_ONLY_REGEX.test(trimmed)) return null;

  if (trimmed.length === 5) {
    return `${trimmed}:00`;
  }

  return trimmed;
}

function sortVisitasBySchedule(a: Visita, b: Visita) {
  const aKey = `${a.data_visita}T${a.hora_visita || "23:59:59"}`;
  const bKey = `${b.data_visita}T${b.hora_visita || "23:59:59"}`;
  return aKey.localeCompare(bKey);
}

export function useVisitas(filters?: {
  status?: string;
  corretorId?: string;
  empreendimento?: string;
  startDate?: string;
  endDate?: string;
}) {
  const { user } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
  const queryClient = useQueryClient();

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ["visitas", filters, user?.id, isAdmin],
    queryFn: async () => {
      let q = supabase
        .from("visitas")
        .select("id, corretor_id, gerente_id, lead_id, pipeline_lead_id, nome_cliente, telefone, empreendimento, origem, origem_detalhe, data_visita, hora_visita, local_visita, status, observacoes, created_at, updated_at, created_by, linked_attempt_id, linked_pdn_id, converted_to_pdn_at, converted_to_pdn_by, resultado_visita, tipo, negocio_id, tipo_reuniao, responsavel_visita")
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

      const corretorIds = [...new Set(rows.map((r) => r.corretor_id).filter(Boolean))];
      if (corretorIds.length > 0) {
        const [profilesRes, membersRes] = await Promise.all([
          supabase.from("profiles").select("user_id, nome").in("user_id", corretorIds),
          supabase.from("team_members").select("user_id, nome, equipe").in("user_id", corretorIds).eq("status", "ativo"),
        ]);

        const nameMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p.nome]));
        const equipeMap = new Map<string, string>();

        (membersRes.data || []).forEach((m) => {
          if (m.user_id) {
            if (!nameMap.get(m.user_id)) nameMap.set(m.user_id, m.nome);
            if (m.equipe) equipeMap.set(m.user_id, m.equipe);
          }
        });

        const gerenteIds = [...new Set(rows.map((r) => r.gerente_id).filter(Boolean))];
        const gerenteNameMap = new Map<string, string>();
        if (gerenteIds.length > 0) {
          const { data: gerenteProfiles } = await supabase
            .from("profiles")
            .select("user_id, nome")
            .in("user_id", gerenteIds);

          (gerenteProfiles || []).forEach((g) => {
            if (g.user_id && g.nome) {
              gerenteNameMap.set(g.user_id, g.nome.split(" ")[0]);
            }
          });
        }

        rows.forEach((r) => {
          r.corretor_nome = nameMap.get(r.corretor_id) as string || undefined;
          r.equipe = (equipeMap.get(r.corretor_id) as string) || (r.gerente_id ? gerenteNameMap.get(r.gerente_id) as string : undefined) || undefined;
        });
      }

      return rows;
    },
    enabled: !!user,
  });

  const createVisita = useCallback(async (visita: Partial<Visita>) => {
    if (!user) return null;

    const input = visita as CreateVisitaInput;
    const isManagerUser = isGestor || isAdmin;

    const requestedCorretorId = extractUuid(input.corretor_id);
    const requestedGerenteId = extractUuid(input.gerente_id);

    let corretorId = user.id;
    let gerenteId: string | null = requestedGerenteId;

    if (isManagerUser && requestedCorretorId) {
      corretorId = requestedCorretorId;
    }

    if (!isManagerUser && requestedCorretorId && requestedCorretorId !== user.id) {
      console.warn("[createVisita] Ignorando corretor_id inválido para corretor comum", {
        requestedCorretorId,
        authUserId: user.id,
      });
    }

    if (isManagerUser && corretorId !== user.id) {
      let teamMemberQuery = supabase
        .from("team_members")
        .select("user_id, gerente_id")
        .eq("user_id", corretorId)
        .eq("status", "ativo")
        .limit(1);

      if (!isAdmin) {
        teamMemberQuery = teamMemberQuery.eq("gerente_id", user.id);
      }

      const { data: teamMember, error: teamMemberError } = await teamMemberQuery.maybeSingle();

      if (teamMemberError || !teamMember) {
        console.error("[createVisita] corretor_id não autorizado para o gestor", {
          requestedCorretorId: corretorId,
          authUserId: user.id,
          error: teamMemberError,
        });
        toast.error("Selecione um corretor válido da sua equipe.");
        return null;
      }

      gerenteId = isAdmin ? (teamMember.gerente_id || gerenteId || user.id) : user.id;
    }

    if (isGestor && !isAdmin) {
      gerenteId = user.id;
    }

    if (!gerenteId) {
      try {
        const { data: tm } = await supabase
          .from("team_members")
          .select("gerente_id")
          .eq("user_id", corretorId)
          .eq("status", "ativo")
          .limit(1)
          .maybeSingle();

        gerenteId = tm?.gerente_id || user.id;
      } catch (e) {
        console.warn("[createVisita] Falha ao resolver gerente_id, usando usuário logado", e);
        gerenteId = user.id;
      }
    }

    const tipo = input.tipo === "negocio" ? "negocio" : "lead";
    const leadId = extractUuid(input.lead_id);
    const pipelineLeadId = extractUuid(input.pipeline_lead_id);

    if (tipo === "lead" && !leadId && !pipelineLeadId) {
      toast.error("Selecione um lead válido antes de agendar a visita.");
      return null;
    }

    const nomeCliente = sanitizeText(input.nome_cliente);
    if (!nomeCliente) {
      toast.error("Informe o nome do cliente.");
      return null;
    }

    const dataVisita =
      normalizeDateForDb(input.data_visita) ||
      new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

    if (!dataVisita) {
      toast.error("Data da visita inválida.");
      return null;
    }

    const horaVisita = normalizeTimeForDb(input.hora_visita);
    if (input.hora_visita && !horaVisita) {
      toast.error("Horário da visita inválido.");
      return null;
    }

    const responsavelVisita = sanitizeText(input.responsavel_visita);
    if (tipo === "lead" && !responsavelVisita) {
      toast.error("Selecione o responsável pela visita.");
      return null;
    }

    const payload = {
      corretor_id: corretorId,
      gerente_id: gerenteId,
      lead_id: leadId,
      pipeline_lead_id: pipelineLeadId,
      nome_cliente: nomeCliente,
      telefone: sanitizeText(input.telefone),
      empreendimento: sanitizeText(input.empreendimento),
      origem: sanitizeText(input.origem) || "manual",
      origem_detalhe: sanitizeText(input.origem_detalhe),
      data_visita: dataVisita,
      hora_visita: horaVisita,
      local_visita: sanitizeText(input.local_visita),
      status: sanitizeText(input.status) || "marcada",
      observacoes: sanitizeText(input.observacoes),
      created_by: user.id,
      linked_attempt_id: extractUuid(input.linked_attempt_id),
      tipo,
      negocio_id: extractUuid(input.negocio_id),
      tipo_reuniao: sanitizeText(input.tipo_reuniao),
      responsavel_visita: responsavelVisita,
    };

    if (import.meta.env.DEV) {
      console.info("[createVisita] payload:", payload);
    }

    const { data, error } = await supabase
      .from("visitas")
      .insert(payload as any)
      .select()
      .single();

    if (error) {
      const debugError = {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      };

      console.error("[createVisita] Erro ao inserir visita", {
        error: debugError,
        payload,
      });

      toast.error(`Erro ao criar visita: ${debugError.message}${debugError.code ? ` (${debugError.code})` : ""}`);
      return null;
    }

    toast.success("📅 Visita agendada com sucesso!");

    queryClient.setQueriesData({ queryKey: ["visitas"] }, (oldData: unknown) => {
      if (!Array.isArray(oldData)) return oldData;
      const visitasAtuais = oldData as Visita[];
      if (visitasAtuais.some((item) => item.id === data.id)) {
        return visitasAtuais;
      }
      return [...visitasAtuais, data as Visita].sort(sortVisitasBySchedule);
    });

    if (data?.pipeline_lead_id) {
      try {
        await supabase
          .from("pipeline_leads")
          .update({
            modulo_atual: "agenda",
          } as any)
          .eq("id", data.pipeline_lead_id);

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
        console.error("[createVisita] Erro ao atualizar progressão do lead", err);
      }
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["visitas"] }),
      queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
      queryClient.invalidateQueries({ queryKey: ["pipeline-leads"] }),
      queryClient.invalidateQueries({ queryKey: ["agenda-visitas"] }),
    ]);

    if (data?.telefone) {
      supabase.functions
        .invoke("visita-whatsapp-confirm", {
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
        })
        .then(({ error: whatsappError }) => {
          if (whatsappError) {
            console.warn("WhatsApp confirmation failed:", whatsappError);
          } else {
            toast.success("📱 Confirmação enviada por WhatsApp!", { duration: 3000 });
          }
        });
    }

    return data;
  }, [user, isGestor, isAdmin, queryClient]);

  const updateVisita = useCallback(async (id: string, updates: Partial<Visita>, silent = false) => {
    const { error } = await supabase
      .from("visitas")
      .update(updates as any)
      .eq("id", id);

    if (error) {
      console.error("Erro ao atualizar visita:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        updates,
        id,
      });
      toast.error("Erro ao atualizar visita");
      return false;
    }

    queryClient.invalidateQueries({ queryKey: ["visitas"] });
    if (!silent) toast.success("Visita atualizada!");
    return true;
  }, [queryClient]);

  const updateStatus = useCallback(async (id: string, newStatus: VisitaStatus) => {
    const result = await updateVisita(id, { status: newStatus } as any, true);

    if (result) {
      toast.success(`Status atualizado para ${STATUS_LABELS[newStatus]}`);

      if (newStatus === "realizada") {
        const visita = visitas.find((v) => v.id === id);
        if (visita?.pipeline_lead_id) {
          toast("✅ Visita realizada!", {
            description: "Use o botão 'Criar Negócio' no card do Pipeline para iniciar o negócio.",
            duration: 5000,
          });
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
      console.error("Erro ao excluir visita:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        id,
      });
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
  const { data: tm } = await supabase
    .from("team_members")
    .select("gerente_id")
    .eq("user_id", params.corretorId)
    .eq("status", "ativo")
    .limit(1)
    .maybeSingle();

  const gerenteId = tm?.gerente_id || params.corretorId;
  const dataVisita = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const payload = {
    corretor_id: params.corretorId,
    gerente_id: gerenteId,
    lead_id: extractUuid(params.leadId),
    nome_cliente: sanitizeText(params.nomeCliente) || "Sem nome",
    telefone: sanitizeText(params.telefone),
    empreendimento: sanitizeText(params.empreendimento),
    origem: "oferta_ativa",
    data_visita: dataVisita,
    status: "marcada",
    observacoes: sanitizeText(params.observacoes),
    created_by: params.corretorId,
    linked_attempt_id: extractUuid(params.attemptId),
    tipo: "lead",
    responsavel_visita: "proprio_corretor",
  };

  const { data, error } = await supabase
    .from("visitas")
    .insert(payload as any)
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar visita automática:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      payload,
    });
  }

  return data;
}
