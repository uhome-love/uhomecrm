import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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
  const [atividades, setAtividades] = useState<PipelineAtividade[]>([]);
  const [anotacoes, setAnotacoes] = useState<PipelineAnotacao[]>([]);
  const [tarefas, setTarefas] = useState<PipelineTarefa[]>([]);
  const [historico, setHistorico] = useState<PipelineHistorico[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    if (!leadId || !user) return;
    setLoading(true);
    try {
      const [atRes, anRes, taRes, hiRes] = await Promise.all([
        supabase.from("pipeline_atividades").select("*").eq("pipeline_lead_id", leadId).order("data", { ascending: false }),
        supabase.from("pipeline_anotacoes").select("*").eq("pipeline_lead_id", leadId).order("fixada", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("pipeline_tarefas").select("*").eq("pipeline_lead_id", leadId).order("created_at", { ascending: false }),
        supabase.from("pipeline_historico").select("*").eq("pipeline_lead_id", leadId).order("created_at", { ascending: false }),
      ]);
      setAtividades((atRes.data || []) as PipelineAtividade[]);
      setAnotacoes((anRes.data || []) as PipelineAnotacao[]);
      setTarefas((taRes.data || []) as PipelineTarefa[]);
      setHistorico((hiRes.data || []) as PipelineHistorico[]);
    } catch (err) {
      console.error("Error loading lead data:", err);
    } finally {
      setLoading(false);
    }
  }, [leadId, user]);

  useEffect(() => { loadAll(); }, [loadAll]);

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
    const profile = await supabase.from("profiles").select("nome").eq("user_id", user.id).single();
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
    if (!user || !leadId) return;
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
    if (error) { toast.error("Erro ao criar tarefa: " + error.message); return; }

    // Update ultima_acao_at on the lead
    await supabase.from("pipeline_leads").update({
      ultima_acao_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any).eq("id", leadId);

    toast.success("Tarefa criada ✅");
    loadAll();
  }, [user, leadId, loadAll]);

  const deleteTarefa = useCallback(async (id: string) => {
    const { error } = await supabase.from("pipeline_tarefas").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir tarefa"); return; }
    toast.success("Tarefa excluída");
    loadAll();
  }, [loadAll]);

  const toggleTarefa = useCallback(async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "concluida" ? "pendente" : "concluida";
    await supabase.from("pipeline_tarefas").update({
      status: newStatus,
      concluida_em: newStatus === "concluida" ? new Date().toISOString() : null,
    } as any).eq("id", id);
    loadAll();
  }, [loadAll]);

  return {
    atividades, anotacoes, tarefas, historico, loading,
    addAtividade, updateAtividade,
    addAnotacao, toggleFixarAnotacao,
    addTarefa, toggleTarefa, deleteTarefa,
    reload: loadAll,
  };
}
