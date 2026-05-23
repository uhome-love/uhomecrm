/**
 * focusTelemetry — fire-and-forget logger para eventos do Modo Foco.
 *
 * Grava em public.ops_events (RLS: INSERT liberado para authenticated em Rodada 0).
 * Nunca lança — se a inserção falhar, registra warn no console e segue.
 *
 * Eventos canônicos:
 *   - focus_mode_opened     → corretor clicou "Iniciar foco" com filtros aplicados
 *   - focus_mode_advance    → avançou para o próximo lead
 *   - focus_mode_closed     → fechou o modal (com ou sem completar a fila)
 *   - task_completion       → R3-V2: concluiu tarefa via dialog 2 telas
 *   - stage_change_failed   → R3-V2: UPDATE de stage_id falhou após INSERT atividade
 *
 * Todos compartilham um `session_id` (uuid gerado no abrir) para correlacionar
 * a jornada inteira em queries posteriores.
 */
import { supabase } from "@/integrations/supabase/client";

export type FocusEvent =
  | "focus_mode_opened"
  | "focus_mode_advance"
  | "focus_mode_closed"
  | "task_completion"
  | "stage_change_failed"
  | "focus_empty_state_shown"
  | "focus_suggestion_clicked";


type LogLevel = "info" | "warn" | "error";

export function newFocusSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `fs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function logFocus(
  event: FocusEvent,
  ctx: Record<string, unknown> = {},
  level: LogLevel = "info"
): void {
  // Fire-and-forget: nunca aguardar nem propagar erro pro UI.
  void supabase
    .from("ops_events")
    .insert({
      fn: event,
      level,
      category: "focus_mode",
      message: event,
      ctx: ctx as never,
    })
    .then(({ error }) => {
      if (error) {
        console.warn("[focusTelemetry] insert failed:", event, error.message);
      }
    });
}
