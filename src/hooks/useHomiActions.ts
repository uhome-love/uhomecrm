/**
 * useHomiActions — Executa ações do Homi Copiloto APÓS confirmação do corretor.
 *
 * Reusa os mesmos caminhos das telas oficiais:
 *  - Tarefa → pipeline_tarefas (mesmos campos da Central de Tarefas)
 *  - Visita → useVisitas.createVisita (mesma lógica da agenda, inclui avanço de etapa)
 *
 * TODA criação também grava em pipeline_atividades (timeline do modal do lead).
 */
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVisitas } from "@/hooks/useVisitas";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateTaskQueries } from "@/lib/taskQueryUtils";
import { isTaskDateTooFar, TASK_DATE_TOO_FAR_MSG } from "@/lib/taskScheduling";
import { toast } from "sonner";

const TIPO_LABELS: Record<string, string> = {
  ligar: "Ligar", whatsapp: "WhatsApp", enviar_material: "Enviar material",
  follow_up: "Follow-up", enviar_proposta: "Enviar proposta", marcar_visita: "Marcar visita", outro: "Outro",
};
const LOCAL_LABELS: Record<string, string> = {
  stand: "Stand", empresa: "Escritório", videochamada: "Videochamada",
  decorado: "Apartamento decorado", no_imovel: "No imóvel", outro: "Outro",
};

async function logAtividade(leadId: string, uid: string, tipo: string, titulo: string, descricao: string | null) {
  await supabase.from("pipeline_atividades").insert({
    pipeline_lead_id: leadId,
    tipo,
    titulo,
    descricao,
    data: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    prioridade: "media",
    responsavel_id: uid,
    status: "pendente",
    created_by: uid,
  } as any);
  await supabase.from("pipeline_leads").update({
    ultima_acao_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any).eq("id", leadId);
}

export interface TarefaConfirm {
  lead_id: string;
  lead_nome: string;
  tipo: string;
  tipo_personalizado?: string;
  vence_em: string;
  hora_vencimento?: string;
  descricao?: string;
}

export interface VisitaConfirm {
  lead_id: string;
  lead_nome: string;
  nome_cliente: string;
  telefone?: string;
  empreendimento?: string;
  data_visita: string;
  hora_visita?: string;
  local_visita?: string;
  responsavel_visita?: string;
  observacoes?: string;
}

export interface LeadOption {
  id: string;
  nome: string;
  telefone: string | null;
  empreendimento: string | null;
}

export function useHomiActions() {
  const { user } = useAuth();
  const { createVisita } = useVisitas();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Busca leads do corretor logado por nome (RLS já escopa ao corretor).
  const searchLeads = useCallback(async (term: string): Promise<LeadOption[]> => {
    const q = (term || "").trim();
    if (q.length < 2) return [];
    const { data, error } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone, empreendimento")
      .eq("arquivado", false)
      .ilike("nome", `%${q}%`)
      .order("updated_at", { ascending: false })
      .limit(8);
    if (error) { console.error("[searchLeads]", error); return []; }
    return (data || []) as LeadOption[];
  }, []);

  // Conclui uma tarefa (mesmo efeito da Central de Tarefas) + histórico no lead.
  const concluirTarefa = useCallback(async (
    tarefaId: string,
    leadId?: string | null,
    leadNome?: string | null,
    titulo?: string | null,
  ): Promise<boolean> => {
    if (!user) { toast.error("Sessão expirada."); return false; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("pipeline_tarefas")
        .update({ status: "concluida", concluida_em: new Date().toISOString() } as any)
        .eq("id", tarefaId);
      if (error) { toast.error("Erro ao concluir: " + error.message); return false; }
      if (leadId) {
        await logAtividade(
          leadId, user.id, "outro",
          `✅ Tarefa concluída via Homi${titulo ? `: ${titulo}` : ""}`,
          null,
        );
      }
      invalidateTaskQueries(queryClient, leadId || undefined);
      toast.success("Tarefa concluída ✅");
      return true;
    } finally {
      setSaving(false);
    }
  }, [user, queryClient]);

  // Registra uma anotação rápida na timeline do lead (com confirmação na UI).
  const anotarLead = useCallback(async (
    leadId: string,
    leadNome: string,
    texto: string,
  ): Promise<boolean> => {
    if (!user) { toast.error("Sessão expirada."); return false; }
    if (!texto.trim()) { toast.error("Escreva a anotação."); return false; }
    setSaving(true);
    try {
      const nomeAutor = (await supabase.from("profiles").select("nome").eq("user_id", user.id).maybeSingle()).data?.nome || "Corretor";
      const { error } = await supabase.from("pipeline_anotacoes").insert({
        pipeline_lead_id: leadId,
        conteudo: texto.trim(),
        autor_id: user.id,
        autor_nome: nomeAutor,
      } as any);
      if (error) { toast.error("Erro ao anotar: " + error.message); return false; }
      await logAtividade(leadId, user.id, "outro", `📝 Anotação via Homi`, texto.trim());
      toast.success("Anotação salva 📝");
      return true;
    } finally {
      setSaving(false);
    }
  }, [user]);

  const confirmarTarefa = useCallback(async (t: TarefaConfirm): Promise<boolean> => {
    if (!user) { toast.error("Sessão expirada."); return false; }
    if (!t.vence_em) { toast.error("Selecione uma data para a tarefa."); return false; }
    if (t.tipo === "outro" && !t.tipo_personalizado?.trim()) { toast.error("Informe o tipo personalizado."); return false; }
    if (isTaskDateTooFar(t.vence_em)) { toast.error(TASK_DATE_TOO_FAR_MSG); return false; }

    setSaving(true);
    try {
      const titulo = t.tipo === "outro" ? (t.tipo_personalizado || "Tarefa") : (TIPO_LABELS[t.tipo] || "Tarefa");
      const { error } = await supabase.from("pipeline_tarefas").insert({
        pipeline_lead_id: t.lead_id,
        titulo,
        descricao: t.descricao?.trim() || null,
        tipo: t.tipo === "outro" ? "outro" : t.tipo,
        prioridade: "media",
        status: "pendente",
        responsavel_id: user.id,
        vence_em: t.vence_em,
        hora_vencimento: t.hora_vencimento || null,
        created_by: user.id,
      } as any);
      if (error) { toast.error("Erro ao criar tarefa: " + error.message); return false; }

      await logAtividade(
        t.lead_id, user.id, "outro",
        `📋 Tarefa criada via Homi: ${titulo}`,
        `${titulo} — ${t.vence_em}${t.hora_vencimento ? " " + t.hora_vencimento : ""}${t.descricao ? " · " + t.descricao : ""}`,
      );
      invalidateTaskQueries(queryClient, t.lead_id);
      toast.success("Tarefa criada ✅");
      return true;
    } finally {
      setSaving(false);
    }
  }, [user, queryClient]);

  const confirmarVisita = useCallback(async (v: VisitaConfirm): Promise<boolean> => {
    if (!user) { toast.error("Sessão expirada."); return false; }
    if (!v.nome_cliente?.trim()) { toast.error("Informe o nome do cliente."); return false; }
    if (!v.data_visita) { toast.error("Selecione a data da visita."); return false; }
    if (!v.responsavel_visita) { toast.error("Selecione o responsável pela visita."); return false; }

    setSaving(true);
    try {
      const created = await createVisita({
        pipeline_lead_id: v.lead_id,
        lead_id: v.lead_id,
        nome_cliente: v.nome_cliente.trim(),
        telefone: v.telefone || null,
        empreendimento: v.empreendimento || null,
        origem: "manual",
        data_visita: v.data_visita,
        hora_visita: v.hora_visita || null,
        local_visita: v.local_visita || null,
        observacoes: v.observacoes || null,
        responsavel_visita: v.responsavel_visita,
        tipo: "lead",
      } as any);
      if (!created) return false; // createVisita já mostra o toast de erro

      const localLabel = v.local_visita ? (LOCAL_LABELS[v.local_visita] || v.local_visita) : "";
      await logAtividade(
        v.lead_id, user.id, "visita",
        `🏠 Visita agendada via Homi`,
        `${v.data_visita}${v.hora_visita ? " " + v.hora_visita : ""}${localLabel ? " · " + localLabel : ""}${v.observacoes ? " · " + v.observacoes : ""}`,
      );
      return true;
    } finally {
      setSaving(false);
    }
  }, [user, createVisita]);

  // Registra o resultado de um contato na timeline do lead (com confirmação na UI).
  const confirmarResultado = useCallback(async (
    leadId: string,
    leadNome: string,
    resultadoLabel: string,
    detalhe?: string,
  ): Promise<boolean> => {
    if (!user) { toast.error("Sessão expirada."); return false; }
    setSaving(true);
    try {
      await logAtividade(
        leadId, user.id, "outro",
        `${resultadoLabel} (via Homi)`,
        detalhe?.trim() || null,
      );
      toast.success("Resultado registrado ✅");
      return true;
    } finally {
      setSaving(false);
    }
  }, [user]);

  return { confirmarTarefa, confirmarVisita, confirmarResultado, searchLeads, concluirTarefa, anotarLead, saving };
}
