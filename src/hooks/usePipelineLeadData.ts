import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Refs de array estáveis pro estado "sem dados" — evita re-render/rebuild dos memos.
const EMPTY: never[] = [];
import { invalidateTaskQueries } from "@/lib/taskQueryUtils";
import { isTaskDateTooFar, TASK_DATE_TOO_FAR_MSG } from "@/lib/taskScheduling";

export interface PipelineAtividade {
  id: string;
  pipeline_lead_id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  data: string;
  hora: string | null;
  prioridade: string;
  responsavel_id: string | null;
  status: string;
  created_by: string;
  created_at: string;
}

export interface PipelineAnotacao {
  id: string;
  pipeline_lead_id: string;
  conteudo: string;
  autor_id: string;
  autor_nome: string | null;
  fixada: boolean;
  created_at: string;
}

export interface PipelineTarefa {
  id: string;
  pipeline_lead_id: string;
  titulo: string;
  descricao: string | null;
  prioridade: string;
  status: string;
  tipo: string;
  responsavel_id: string | null;
  vence_em: string | null;
  hora_vencimento: string | null;
  concluida_em: string | null;
  created_by: string;
  created_at: string;
  origem?: string | null;
  subtipo?: string | null;
}


export interface PipelineHistorico {
  id: string;
  pipeline_lead_id: string;
  stage_anterior_id: string | null;
  stage_novo_id: string;
  movido_por: string;
  observacao: string | null;
  created_at: string;
}

export function usePipelineLeadData(leadId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Dados do modal cacheados via React Query. Antes rebuscava 4 tabelas do ZERO a cada
  // abertura (a "História demorava a aparecer"); agora reabrir o mesmo lead é instantâneo
  // (staleTime) e as mutações invalidam pra revalidar.
  const query = useQuery({
    queryKey: ["lead-detail-data", leadId, user?.id],
    enabled: !!leadId && !!user,
    staleTime: 20_000,
    queryFn: async () => {
      // Uma onda só: tudo que a aba História precisa vai junto (antes, visita_eventos
      // e lia_estado eram useEffect separados, criando uma 3ª onda de requisições).
      const [atRes, anRes, taRes, hiRes, veRes, liaRes] = await Promise.all([
        supabase.from("pipeline_atividades").select("*").eq("pipeline_lead_id", leadId!).order("data", { ascending: false }),
        supabase.from("pipeline_anotacoes").select("*").eq("pipeline_lead_id", leadId!).order("fixada", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("pipeline_tarefas").select("*").eq("pipeline_lead_id", leadId!).order("created_at", { ascending: false }),
        supabase.from("pipeline_historico").select("*").eq("pipeline_lead_id", leadId!).order("created_at", { ascending: false }),
        supabase.from("visita_eventos" as any)
          .select("id, tipo, status_anterior, status_novo, data_anterior, data_nova, ator_id, created_at")
          .eq("pipeline_lead_id", leadId!).order("created_at", { ascending: false }),
        supabase.from("lia_estado").select("telefone").eq("lead_id", leadId!).maybeSingle(),
      ]);
      return {
        atividades: (atRes.data || []) as PipelineAtividade[],
        anotacoes: (anRes.data || []) as PipelineAnotacao[],
        tarefas: (taRes.data || []) as PipelineTarefa[],
        historico: (hiRes.data || []) as PipelineHistorico[],
        visitaEventos: (veRes.data || []) as any[],
        temLiaConversa: !!(liaRes.data as any)?.telefone,
      };
    },
  });


  const atividades = query.data?.atividades ?? (EMPTY as PipelineAtividade[]);
  const anotacoes = query.data?.anotacoes ?? (EMPTY as PipelineAnotacao[]);
  const tarefas = query.data?.tarefas ?? (EMPTY as PipelineTarefa[]);
  const historico = query.data?.historico ?? (EMPTY as PipelineHistorico[]);
  const visitaEventos = query.data?.visitaEventos ?? (EMPTY as any[]);
  const temLiaConversa = query.data?.temLiaConversa ?? false;
  const loading = query.isLoading;

  // "reload" mantém o nome antigo (usado pelas mutações e exposto na API): agora invalida o cache.
  const loadAll = useCallback(() => {
    if (leadId) queryClient.invalidateQueries({ queryKey: ["lead-detail-data", leadId] });
  }, [leadId, queryClient]);

  const addAtividade = useCallback(async (data: Partial<PipelineAtividade>) => {
    if (!user || !leadId) return;
    const { error } = await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: leadId,
      tipo: data.tipo || "ligacao",
      titulo: data.titulo || "",
      descricao: data.descricao || null,
      data: data.data || new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
      hora: data.hora || null,
      prioridade: data.prioridade || "media",
      responsavel_id: data.responsavel_id || user.id,
      status: "pendente",
      created_by: user.id,
    });
    if (error) { toast.error("Erro ao criar atividade"); return; }

    // BUG 2 FIX: Update ultima_acao_at so dashboard KPIs refresh
    await supabase.from("pipeline_leads").update({
      ultima_acao_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any).eq("id", leadId);

    toast.success("Atividade criada");
    loadAll();
  }, [user, leadId, loadAll]);

  const updateAtividade = useCallback(async (id: string, updates: Partial<PipelineAtividade>) => {
    const { error } = await supabase.from("pipeline_atividades").update(updates as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar atividade"); return; }
    loadAll();
  }, [loadAll]);

  const addAnotacao = useCallback(async (conteudo: string) => {
    if (!user || !leadId) return;
    const profile = await supabase.from("profiles").select("nome").eq("user_id", user.id).maybeSingle();
    const { error } = await supabase.from("pipeline_anotacoes").insert({
      pipeline_lead_id: leadId,
      conteudo,
      autor_id: user.id,
      autor_nome: profile.data?.nome || "Usuário",
    });
    if (error) { toast.error("Erro ao criar anotação"); return; }

    // Update ultima_acao_at
    await supabase.from("pipeline_leads").update({
      ultima_acao_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any).eq("id", leadId);

    loadAll();
  }, [user, leadId, loadAll]);

  const toggleFixarAnotacao = useCallback(async (id: string, fixada: boolean) => {
    await supabase.from("pipeline_anotacoes").update({ fixada: !fixada } as any).eq("id", id);
    loadAll();
  }, [loadAll]);

  const addTarefa = useCallback(async (data: Partial<PipelineTarefa>) => {
    if (!user || !leadId) {
      console.error("[addTarefa] bloqueado: sem usuário/lead", { hasUser: !!user, leadId });
      toast.error("Sessão expirou ou lead não carregado. Recarregue a página.");
      return false;
    }
    if (isTaskDateTooFar(data.vence_em)) {
      toast.error(TASK_DATE_TOO_FAR_MSG);
      return false;
    }
    const { error } = await supabase.from("pipeline_tarefas").insert({
      pipeline_lead_id: leadId,
      titulo: data.titulo || "",
      descricao: data.descricao || null,
      tipo: data.tipo || "follow_up",
      prioridade: data.prioridade || "media",
      status: "pendente",
      responsavel_id: data.responsavel_id || user.id,
      vence_em: data.vence_em || null,
      hora_vencimento: data.hora_vencimento || null,
      created_by: user.id,
    } as any);
    if (error) {
      console.error("[addTarefa] insert falhou", error);
      toast.error("Erro ao criar tarefa: " + error.message);
      return false;
    }

    // Update ultima_acao_at on the lead
    await supabase.from("pipeline_leads").update({
      ultima_acao_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any).eq("id", leadId);

    toast.success("Tarefa criada ✅");
    invalidateTaskQueries(queryClient, leadId);
    loadAll();
    return true;
  }, [user, leadId, loadAll, queryClient]);

  const deleteTarefa = useCallback(async (id: string) => {
    const { error } = await supabase.from("pipeline_tarefas").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir tarefa"); return; }
    toast.success("Tarefa excluída");
    loadAll();
    invalidateTaskQueries(queryClient, leadId);
  }, [loadAll, queryClient, leadId]);

  const toggleTarefa = useCallback(async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "concluida" ? "pendente" : "concluida";
    const { error } = await supabase.from("pipeline_tarefas").update({
      status: newStatus,
      concluida_em: newStatus === "concluida" ? new Date().toISOString() : null,
    } as any).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar tarefa");
      return;
    }
    if (newStatus === "concluida") {
      toast.success("Tarefa concluída");
    }
    loadAll();
    invalidateTaskQueries(queryClient, leadId);
  }, [loadAll, queryClient, leadId]);

  return {
    atividades, anotacoes, tarefas, historico, loading,
    addAtividade, updateAtividade,
    addAnotacao, toggleFixarAnotacao,
    addTarefa, toggleTarefa, deleteTarefa,
    reload: loadAll,
  };
}
