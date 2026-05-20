/**
 * focusTelemetry — fire-and-forget logger para eventos do Modo Foco.
 *
 * Grava em public.ops_events (RLS: INSERT liberado para authenticated em Rodada 0).
 * Nunca lança — se a inserção falhar, registra warn no console e segue.
 *
 * Eventos canônicos:
 *   - focus_mode_opened   → corretor clicou "Iniciar foco" com filtros aplicados
 *   - focus_mode_advance  → avançou para o próximo lead
 *   - focus_mode_closed   → fechou o modal (com ou sem completar a fila)
 *
 * Todos compartilham um `session_id` (uuid gerado no abrir) para correlacionar
 * a jornada inteira em queries posteriores.
 */
import { supabase } from "@/integrations/supabase/client";

export type FocusEvent = "focus_mode_opened" | "focus_mode_advance" | "focus_mode_closed";

export function newFocusSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `fs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function logFocus(event: FocusEvent, ctx: Record<string, unknown> = {}): void {
  // Fire-and-forget: nunca aguardar nem propagar erro pro UI.
  void supabase
    .from("ops_events")
    .insert({
      fn: event,
      level: "info",
      category: "focus_mode",
      message: event,
      ctx: ctx as any,
    })
    .then(({ error }) => {
      if (error) {
        // Console-only: telemetria não pode quebrar UX
        console.warn("[focusTelemetry] insert failed:", event, error.message);
      }
    });
}
