/**
 * Regras de agendamento de tarefas do pipeline.
 *
 * Regra de negócio: corretor só pode agendar uma tarefa para no máximo
 * 30 dias à frente. Isso evita "burlar" o motor de estagnação criando
 * tarefas muito distantes (ex.: 2 meses) só para o lead não estagnar.
 *
 * O banco também garante a regra via trigger (defesa central). Estes
 * helpers servem para o frontend limitar os seletores de data e validar
 * antes de enviar, com mensagem amigável.
 */

export const MAX_TASK_DAYS_AHEAD = 30;

/** Data máxima permitida (YYYY-MM-DD, fuso BRT) para vencimento de tarefa. */
export function maxTaskDateBRT(): string {
  const d = new Date();
  d.setDate(d.getDate() + MAX_TASK_DAYS_AHEAD);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Retorna true se a data (YYYY-MM-DD) está além do teto de 30 dias. */
export function isTaskDateTooFar(venceEm?: string | null): boolean {
  if (!venceEm) return false;
  return venceEm > maxTaskDateBRT();
}

export const TASK_DATE_TOO_FAR_MSG =
  "Tarefas podem ser agendadas para no máximo 30 dias à frente.";
