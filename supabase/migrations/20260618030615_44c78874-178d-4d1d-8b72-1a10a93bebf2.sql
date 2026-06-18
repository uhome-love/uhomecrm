CREATE INDEX IF NOT EXISTS idx_pipeline_tarefas_lead_status_venc
  ON public.pipeline_tarefas (pipeline_lead_id, status, vence_em, hora_vencimento);