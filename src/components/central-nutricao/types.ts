import type { Tables } from "@/integrations/supabase/types";

/** Rows das tabelas do domínio de reengajamento (tipadas a partir do schema gerado). */
export type ReengajamentoConfig = Tables<"reengajamento_config">;
export type DispatchRun = Tables<"reengajamento_dispatch_runs">;
export type DispatchQueueItem = Tables<"reengajamento_dispatch_queue">;
export type BlockedTemplate = Pick<Tables<"blocked_templates">, "template_name" | "reason">;

/** Resposta padrão das edge functions de disparo/reativação. */
export interface DispatchInvokeResult {
  ok?: boolean;
  reason?: string;
  motivo?: string;
  count?: number;
  total?: number;
  run_id?: string;
  distribuicao?: { success?: boolean } | null;
  [key: string]: unknown;
}
