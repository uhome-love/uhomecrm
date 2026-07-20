// ─────────────────────────────────────────────────────────────────
// completeLeadTask — helper compartilhado para concluir uma tarefa de LEAD
// a partir do payload do TaskCompletionDialog. Espelha o fluxo que existe
// em src/pages/MinhasTarefas.tsx (handleCompletionConfirm, ramo `categoria !== 'negocios'`).
//
// Usado pelo atalho de check no CardMinimal para concluir a tarefa direto
// no card, sem abrir o drawer completo do lead.
// ─────────────────────────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";
import type { CompletionPayload } from "@/components/pipeline/task-completion/types";

export interface CompleteLeadTaskInput {
  tarefaId: string;
  tarefaTitulo: string;
  leadId: string;
  leadNome?: string | null;
  userId: string;
  payload: CompletionPayload;
}

export async function completeLeadTask({
  tarefaId,
  tarefaTitulo,
  leadId,
  leadNome,
  userId,
  payload,
}: CompleteLeadTaskInput): Promise<{ toast: string }> {
  // Fluxo custom (ex.: VisitaCompletionFlow) já executou tudo — só reporta sucesso.
  if (payload.already_handled) {
    return { toast: "Tarefa concluída ✅" };
  }

  const {
    tipo_contato, resultado, descricao,
    outcome, nova_tarefa, novo_stage_id,
    reason_label, status_etapa,
  } = payload;

  const now = new Date().toISOString();

  const { error: toggleErr } = await supabase.from("pipeline_tarefas")
    .update({ status: "concluida", concluida_em: now } as never).eq("id", tarefaId);
  if (toggleErr) throw toggleErr;

  // Persiste status da etapa (Qualificação/Aquecimento) em flag_status
  if (status_etapa?.key && status_etapa.value) {
    const { data: leadRow } = await supabase
      .from("pipeline_leads")
      .select("flag_status")
      .eq("id", leadId)
      .maybeSingle();
    const nextFlag: Record<string, unknown> = {
      ...(((leadRow as { flag_status?: Record<string, unknown> } | null)?.flag_status) || {}),
    };
    nextFlag[status_etapa.key] = status_etapa.value;
    await supabase.from("pipeline_leads")
      .update({ flag_status: nextFlag, ultima_acao_at: now, updated_at: now } as never)
      .eq("id", leadId);
  } else {
    await supabase.from("pipeline_leads")
      .update({ ultima_acao_at: now, updated_at: now } as never).eq("id", leadId);
  }


  await supabase.from("pipeline_atividades").insert({
    pipeline_lead_id: leadId,
    tipo: tipo_contato,
    tipo_contato,
    resultado,
    titulo: `${tarefaTitulo} — ${resultado}`,
    descricao: descricao ?? null,
    data: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    hora: new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    prioridade: "media",
    status: "concluida",
    created_by: userId,
  } as never);

  let toastMsg = "Tarefa concluída ✅";

  if (outcome === "agendar" && nova_tarefa) {
    const nome = leadNome || "Lead";
    const TIPO_LABELS_MAP: Record<string, string> = {
      ligacao: "Ligar", whatsapp: "WhatsApp", follow_up: "Follow-up",
      visita: "Visita", proposta: "Proposta", email: "E-mail",
    };
    const [yPt, mPt, dPt] = (nova_tarefa.vence_em || "").split("-");
    const dateSuffix = yPt && mPt && dPt ? ` · ${dPt}/${mPt}` : "";
    const titulo = `${TIPO_LABELS_MAP[nova_tarefa.tipo] || nova_tarefa.tipo}: ${nome}${dateSuffix}`;
    const { error: insertErr } = await supabase.from("pipeline_tarefas").insert({
      pipeline_lead_id: leadId,
      tipo: nova_tarefa.tipo,
      titulo,
      descricao: nova_tarefa.obs?.trim() || descricao?.trim() || null,
      prioridade: "media",
      status: "pendente",
      responsavel_id: userId,
      vence_em: nova_tarefa.vence_em,
      hora_vencimento: nova_tarefa.hora_vencimento || null,
      created_by: userId,
    } as never);
    if (insertErr) throw insertErr;
    toastMsg = "Tarefa concluída e próxima agendada ✅";
  }

  if ((outcome === "agendar" || outcome === "concluir") && novo_stage_id) {
    const { error: stageErr } = await supabase.from("pipeline_leads").update({
      stage_id: novo_stage_id,
      stage_changed_at: now,
      updated_at: now,
    } as never).eq("id", leadId);
    if (!stageErr) {
      await supabase.from("pipeline_historico").insert({
        pipeline_lead_id: leadId,
        stage_novo_id: novo_stage_id,
        movido_por: userId,
        observacao: "Movido via card do Kanban (conclusão)",
      } as never);
    }
  }

  if (outcome === "descartar") {
    const { buildMotivoDescarte } = await import("@/lib/leadOutcome");
    const motivo = buildMotivoDescarte("reengajavel", reason_label || "Sem motivo informado");
    const { data: descarteStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_tipo", "leads")
      .eq("tipo", "descarte")
      .limit(1)
      .maybeSingle();
    if (descarteStage) {
      const { error } = await supabase.from("pipeline_leads").update({
        stage_id: descarteStage.id,
        stage_changed_at: now,
        updated_at: now,
        motivo_descarte: motivo,
        tipo_descarte: "reengajavel",
        arquivado: false,
      } as never).eq("id", leadId);
      if (!error) {
        await supabase.from("pipeline_historico").insert({
          pipeline_lead_id: leadId,
          stage_novo_id: descarteStage.id,
          movido_por: userId,
          observacao: motivo,
        } as never);
        toastMsg = "Lead descartado ✅";
      }
    }
  }

  if (outcome === "inativar") {
    const { buildMotivoDescarte } = await import("@/lib/leadOutcome");
    const motivo = buildMotivoDescarte("definitivo", reason_label || "Sem motivo informado");
    const { error } = await supabase.from("pipeline_leads").update({
      motivo_descarte: motivo,
      tipo_descarte: "definitivo",
      arquivado: true,
      ultima_acao_at: now,
      updated_at: now,
    } as never).eq("id", leadId);
    if (!error) toastMsg = "Lead inativado ✅";
  }

  return { toast: toastMsg };
}
