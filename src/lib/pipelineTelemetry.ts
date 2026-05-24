/**
 * pipelineTelemetry — fire-and-forget logger para eventos do Pipeline v2.
 *
 * Grava em public.ops_events (mesma tabela usada por focusTelemetry).
 * Nunca aguarda, nunca lança — falha silenciosa.
 *
 * Eventos canônicos (P3):
 *   1. pipeline_card_clicked        — clique no card (abre drawer)
 *   2. pipeline_card_menu_opened    — abriu o menu ··· do card
 *   3. pipeline_card_menu_action    — ação dentro do menu ···
 *   4. pipeline_sort_changed        — trocou ordenação (reservado)
 *   5. pipeline_filtro_clicked      — clicou pílula de filtro
 *   6. drawer_action_clicked        — botão do drawer (Ligar/WhatsApp/...)
 *   7. drawer_anotar_saved          — salvou anotação no drawer
 *   8. pipeline_stage_changed       — DnD concluído (lead trocou de etapa)
 */
import { supabase } from "@/integrations/supabase/client";
import { getDeviceSource } from "./deviceSource";

export type PipelineEvent =
  | "pipeline_card_clicked"
  | "pipeline_card_menu_opened"
  | "pipeline_card_menu_action"
  | "pipeline_sort_changed"
  | "pipeline_filtro_clicked"
  | "drawer_action_clicked"
  | "drawer_anotar_saved"
  | "pipeline_stage_changed";

export interface PipelinePayload {
  lead_id?: string;
  stage_id?: string;
  corretor_id?: string | null;
  source?: "desktop" | "mobile";
  [key: string]: unknown;
}

export function trackPipelineEvent(
  event: PipelineEvent,
  payload: PipelinePayload = {}
): void {
  try {
    const ctx = { source: getDeviceSource(), ...payload };
    void supabase
      .from("ops_events")
      .insert({
        fn: event,
        level: "info",
        category: "pipeline_v2",
        message: event,
        ctx: ctx as never,
      })
      .then(({ error }) => {
        if (error) {
          // silencioso: telemetria nunca bloqueia UI
          // eslint-disable-next-line no-console
          console.debug("[pipelineTelemetry]", event, error.message);
        }
      });
  } catch {
    // silencioso
  }
}
