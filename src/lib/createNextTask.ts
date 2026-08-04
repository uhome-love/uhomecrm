/**
 * createNextTask — fonte ÚNICA de criação da "próxima tarefa" de um lead.
 *
 * Unifica os dois caminhos que antes gravavam campos diferentes:
 *  - NextActionModal (gravava pipeline_tarefas + proxima_acao/data_proxima_acao/flag_status)
 *  - runTaskCompletion (outcome='agendar') que só gravava pipeline_tarefas + ultima_acao_at
 *
 * Grava SEMPRE, de forma consistente:
 *   1) INSERT em pipeline_tarefas (status 'pendente')
 *   2) UPDATE pipeline_leads: proxima_acao, data_proxima_acao, ultima_acao_at, updated_at
 *      (+ flag_status mesclado quando vem de um preset com syncFlag)
 *
 * Sem toast, sem invalidate e sem reload — cada tela segue responsável por isso.
 *
 * ATENÇÃO (regra 20/07/2026): na etapa "Sem Contato" a próxima tarefa é criada
 * SEMPRE pelo gatilho de banco (trg_cadencia_sem_contato). Este helper nunca deve
 * ser chamado nesse caminho.
 */
import { supabase } from "@/integrations/supabase/client";
import { isTaskDateTooFar, taskDateTooFarMessage } from "@/lib/taskScheduling";

export interface CreateNextTaskInput {
  leadId: string;
  userId: string;
  tipo: string;
  titulo: string;
  descricao?: string | null;
  /** YYYY-MM-DD (BRT) */
  vence_em: string;
  hora_vencimento?: string | null;
  prioridade?: string;
  /** Tipo da etapa atual — usado só para validar o limite de data. */
  stageTipo?: string | null;
  /** Preset opcional: aplica flag_status[key] = value no lead. */
  syncFlag?: { key: string; value: string } | null;
}

export interface CreateNextTaskResult {
  ok: boolean;
  error?: string;
}

export async function createNextTask(
  input: CreateNextTaskInput,
): Promise<CreateNextTaskResult> {
  const {
    leadId,
    userId,
    tipo,
    titulo,
    descricao,
    vence_em,
    hora_vencimento,
    prioridade = "media",
    stageTipo = null,
    syncFlag = null,
  } = input;

  if (isTaskDateTooFar(vence_em, stageTipo)) {
    return { ok: false, error: taskDateTooFarMessage(stageTipo) };
  }

  // 1) Tarefa
  const { error: insertErr } = await supabase.from("pipeline_tarefas").insert({
    pipeline_lead_id: leadId,
    titulo,
    descricao: descricao?.trim() ? descricao.trim() : null,
    tipo,
    prioridade,
    status: "pendente",
    responsavel_id: userId,
    vence_em,
    hora_vencimento: hora_vencimento || null,
    created_by: userId,
  } as never);
  if (insertErr) return { ok: false, error: insertErr.message };

  // 2) flag_status do preset (merge com o que já existe)
  let flagPatch: Record<string, string> | null = null;
  if (syncFlag?.key && syncFlag?.value) {
    const { data: leadRow } = await supabase
      .from("pipeline_leads")
      .select("flag_status")
      .eq("id", leadId)
      .maybeSingle();
    const currentFlags =
      (((leadRow as { flag_status?: Record<string, string> } | null)?.flag_status) ??
        {}) as Record<string, string>;
    flagPatch = { ...currentFlags, [syncFlag.key]: syncFlag.value };
  }

  // 3) Estado da "próxima ação" no lead
  const nowIso = new Date().toISOString();
  await supabase
    .from("pipeline_leads")
    .update({
      proxima_acao: titulo,
      data_proxima_acao: vence_em,
      ultima_acao_at: nowIso,
      updated_at: nowIso,
      ...(flagPatch ? { flag_status: flagPatch } : {}),
    } as never)
    .eq("id", leadId);

  return { ok: true };
}
