-- Recreate the plain created_at index (dropped by failed migration rollback check)
-- and add pipeline_lead_id index for the nested loop join path.
-- 
-- Note: Expression indexes on (created_at::date) are not possible because
-- timestamptz→date cast is not IMMUTABLE (timezone-dependent).
-- The real optimization path is to update the views to use range comparisons
-- on the raw timestamptz column instead of casting to date.
-- For now, the pipeline_lead_id index helps the nested loop in v_kpi_gestao_leads.

CREATE INDEX IF NOT EXISTS idx_oa_tentativas_created_at
  ON public.oferta_ativa_tentativas (created_at);

CREATE INDEX IF NOT EXISTS idx_pipeline_historico_lead_id
  ON public.pipeline_historico (pipeline_lead_id);