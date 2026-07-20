/**
 * Regras de agendamento de tarefas do pipeline.
 *
 * Regra geral: no máximo 30 dias à frente.
 * Regra da etapa Sem Contato: no máximo 48 horas à frente — o ritmo
 * da cadência é diário e prazos longos "burlam" o motor de estagnação.
 *
 * O banco garante ambas via trigger (`_pipeline_tarefas_cap_30d`). Os helpers
 * aqui servem para o frontend limitar seletores de data e validar antes
 * de enviar, com mensagem amigável.
 */

export const MAX_TASK_DAYS_AHEAD = 30;
export const MAX_TASK_DAYS_AHEAD_AQUECIMENTO = 90;
export const MAX_TASK_HOURS_SEM_CONTATO = 48;

/** Quantos dias à frente uma tarefa pode ser agendada conforme a etapa. */
export function maxTaskDaysAhead(stageTipo?: string | null): number {
  if (stageTipo === "aquecimento") return MAX_TASK_DAYS_AHEAD_AQUECIMENTO;
  return MAX_TASK_DAYS_AHEAD;
}

/** Data máxima permitida (YYYY-MM-DD, fuso BRT) para vencimento de tarefa. */
export function maxTaskDateBRT(stageTipo?: string | null): string {
  const d = new Date();
  if (stageTipo === "sem_contato") {
    // 48h = amanhã (D+1) no BRT — para o datepicker, retornamos a data de D+2
    // para permitir escolher entre hoje e amanhã sem cortar horas úteis.
    d.setDate(d.getDate() + 2);
  } else if (stageTipo === "aquecimento") {
    d.setDate(d.getDate() + MAX_TASK_DAYS_AHEAD_AQUECIMENTO);
  } else {
    d.setDate(d.getDate() + MAX_TASK_DAYS_AHEAD);
  }
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Retorna true se a data (YYYY-MM-DD) está além do teto permitido. */
export function isTaskDateTooFar(venceEm?: string | null, stageTipo?: string | null): boolean {
  if (!venceEm) return false;
  return venceEm > maxTaskDateBRT(stageTipo);
}

export const TASK_DATE_TOO_FAR_MSG =
  "Tarefas podem ser agendadas para no máximo 30 dias à frente.";

export const TASK_DATE_TOO_FAR_AQUECIMENTO_MSG =
  "No Aquecimento, tarefas podem ser agendadas para no máximo 90 dias à frente.";

export const TASK_DATE_TOO_FAR_SEM_CONTATO_MSG =
  "Em Sem Contato, tarefas só podem ser agendadas para no máximo 48h à frente. Essa etapa tem ritmo diário.";

/** Retorna a mensagem correta conforme a etapa do lead. */
export function taskDateTooFarMessage(stageTipo?: string | null): string {
  if (stageTipo === "sem_contato") return TASK_DATE_TOO_FAR_SEM_CONTATO_MSG;
  if (stageTipo === "aquecimento") return TASK_DATE_TOO_FAR_AQUECIMENTO_MSG;
  return TASK_DATE_TOO_FAR_MSG;
}

/** Faz clamp para o teto e retorna { value, clamped }. */
export function clampTaskDate(
  venceEm: string,
  stageTipo?: string | null,
): { value: string; clamped: boolean } {
  const max = maxTaskDateBRT(stageTipo);
  if (venceEm && venceEm > max) return { value: max, clamped: true };
  return { value: venceEm, clamped: false };
}

/** Formata YYYY-MM-DD como dd/mm para mensagens curtas. */
export function formatBrDateShort(iso: string): string {
  const [, m, d] = (iso || "").split("-");
  return d && m ? `${d}/${m}` : iso;
}
