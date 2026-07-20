/**
 * Orquestrador pós-conclusão de tarefa — extraído de LeadTarefasTab (2026-05-24).
 * Reusado por DrawerTasksTab (drawer v4) e potencialmente por outros consumidores
 * do TaskCompletionDialog (Sprint 1 R3-V2). LeadTarefasTab legado mantém sua
 * própria cópia inline (não tocar conforme escopo).
 *
 * Recebe payload do TaskCompletionDialog + contexto do lead e executa:
 *  - marca tarefa concluída
 *  - touch no lead (ultima_acao_at / updated_at)
 *  - insere pipeline_atividades (sempre)
 *  - outcome 'agendar': cria próxima tarefa via onAddTarefa
 *  - outcome 'agendar' | 'concluir': move stage se novo_stage_id informado
 *  - outcome 'descartar': move para etapa Descarte (reengajável)
 *  - outcome 'inativar': arquiva lead (definitivo)
 *
 * Retorna a mensagem de toast (caller dispara o toast/reload).
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { todayBRT } from "@/lib/utils";
import type {
  CompletionPayload,
  TipoProximaTarefa,
} from "@/components/pipeline/task-completion/types";

const TIPO_LABELS: Record<string, string> = {
  follow_up: "Follow-up",
  ligar: "Ligar",
  ligacao: "Ligar",
  whatsapp: "WhatsApp",
  email: "E-mail",
  enviar_proposta: "Enviar proposta",
  proposta: "Enviar proposta",
  enviar_material: "Enviar material",
  marcar_visita: "Marcar visita",
  visita: "Visita",
  confirmar_visita: "Confirmar visita",
  retornar_cliente: "Retornar cliente",
  outro: "Outro",
};

export interface TaskCompletionContext {
  tarefaId: string;
  tarefaTitulo: string;
  leadId: string;
  leadNome: string;
  leadStageId?: string | null;
  /** Cria a próxima tarefa quando outcome === 'agendar'. */
  addTarefa: (input: {
    tipo: TipoProximaTarefa;
    titulo: string;
    descricao?: string | null;
    vence_em: string;
    hora_vencimento?: string | null;
  }) => Promise<unknown>;
}

export interface TaskCompletionResult {
  toastMessage: string;
  level: "success" | "warning" | "error";
}

export async function runTaskCompletion(
  ctx: TaskCompletionContext,
  payload: CompletionPayload,
): Promise<TaskCompletionResult> {
  // Fluxo custom (VisitaCompletionFlow) já rodou — só sucesso.
  if (payload.already_handled) {
    return { toastMessage: "Tarefa concluída ✅", level: "success" };
  }

  const {
    tipo_contato,
    resultado,
    descricao,
    outcome,
    nova_tarefa,
    novo_stage_id,
    reason_label,
  } = payload;

  const now = new Date().toISOString();
  const userId =
    (await supabase.auth.getUser()).data?.user?.id || "";

  // 1) Marca tarefa concluída
  const { error: taskErr } = await supabase
    .from("pipeline_tarefas")
    .update({
      status: "concluida",
      concluida_em: now,
    } as never)
    .eq("id", ctx.tarefaId);
  if (taskErr) {
    return { toastMessage: "Erro ao concluir tarefa: " + taskErr.message, level: "error" };
  }

  // 2) Touch no lead
  await supabase
    .from("pipeline_leads")
    .update({ ultima_acao_at: now, updated_at: now } as never)
    .eq("id", ctx.leadId);

  // 3) Atividade (sempre)
  await supabase.from("pipeline_atividades").insert({
    pipeline_lead_id: ctx.leadId,
    tipo: tipo_contato,
    tipo_contato,
    resultado,
    titulo: `${ctx.tarefaTitulo} — ${resultado}`,
    descricao: descricao ?? null,
    data: todayBRT(),
    hora: new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    }),
    prioridade: "media",
    status: "concluida",
    created_by: userId,
  } as never);

  let toastMessage = "Tarefa concluída ✅";
  let level: TaskCompletionResult["level"] = "success";

  // 4) Outcome: agendar → cria próxima tarefa
  if (outcome === "agendar" && nova_tarefa) {
    const [y, m, d] = (nova_tarefa.vence_em || "").split("-");
    const dateSuffix = y && m && d ? ` · ${d}/${m}` : "";
    const titulo = `${TIPO_LABELS[nova_tarefa.tipo] || nova_tarefa.tipo}: ${ctx.leadNome}${dateSuffix}`;
    await ctx.addTarefa({
      tipo: nova_tarefa.tipo,
      titulo,
      descricao: nova_tarefa.obs?.trim() || descricao?.trim() || null,
      vence_em: nova_tarefa.vence_em,
      hora_vencimento: nova_tarefa.hora_vencimento || null,
    });
    toastMessage = "Tarefa concluída e próxima agendada ✅";
  }

  // 5) Opcional: mover stage (agendar | concluir)
  if (
    (outcome === "agendar" || outcome === "concluir") &&
    novo_stage_id &&
    novo_stage_id !== ctx.leadStageId
  ) {
    const { error: stageErr } = await supabase
      .from("pipeline_leads")
      .update({
        stage_id: novo_stage_id,
        stage_changed_at: now,
        updated_at: now,
      } as never)
      .eq("id", ctx.leadId);
    if (stageErr) {
      toast.warning("Tarefa concluída, mas etapa não foi alterada.");
    } else {
      await supabase.from("pipeline_historico").insert({
        pipeline_lead_id: ctx.leadId,
        stage_novo_id: novo_stage_id,
        movido_por: userId,
        observacao: "Movido via conclusão de tarefa",
      });
    }
  }

  // 6) Descartar (reengajável)
  if (outcome === "descartar") {
    const { buildMotivoDescarte } = await import("@/lib/leadOutcome");
    const motivo = buildMotivoDescarte(
      "reengajavel",
      reason_label || "Sem motivo informado",
    );
    const { data: descarteStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_tipo", "leads")
      .eq("tipo", "descarte")
      .limit(1)
      .maybeSingle();
    if (!descarteStage) {
      return { toastMessage: "Etapa de Descarte não encontrada.", level: "error" };
    }
    const { error } = await supabase
      .from("pipeline_leads")
      .update({
        stage_id: descarteStage.id,
        stage_changed_at: now,
        updated_at: now,
        motivo_descarte: motivo,
        tipo_descarte: "reengajavel",
        arquivado: false,
      } as never)
      .eq("id", ctx.leadId);
    if (error) {
      return { toastMessage: "Não foi possível descartar: " + error.message, level: "error" };
    }
    await supabase.from("pipeline_historico").insert({
      pipeline_lead_id: ctx.leadId,
      stage_anterior_id: ctx.leadStageId ?? null,
      stage_novo_id: descarteStage.id,
      movido_por: userId,
      observacao: motivo,
    } as never);
    toastMessage = "Lead descartado ✅";
  }

  // 7) Inativar (definitivo)
  if (outcome === "inativar") {
    const { buildMotivoDescarte } = await import("@/lib/leadOutcome");
    const motivo = buildMotivoDescarte(
      "definitivo",
      reason_label || "Sem motivo informado",
    );
    const { error } = await supabase
      .from("pipeline_leads")
      .update({
        motivo_descarte: motivo,
        tipo_descarte: "definitivo",
        arquivado: true,
        ultima_acao_at: now,
        updated_at: now,
      } as never)
      .eq("id", ctx.leadId);
    if (error) {
      return { toastMessage: "Não foi possível inativar: " + error.message, level: "error" };
    }
    toastMessage = "Lead inativado ✅";
  }

  console.info("[task_completed]", {
    lead_id: ctx.leadId,
    tarefa_id: ctx.tarefaId,
    outcome,
  });

  return { toastMessage, level };
}
