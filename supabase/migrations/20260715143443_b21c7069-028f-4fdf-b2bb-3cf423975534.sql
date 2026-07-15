ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS meta_lead_id TEXT,
  ADD COLUMN IF NOT EXISTS capi_enviado_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_meta_lead_id
  ON public.pipeline_leads (meta_lead_id)
  WHERE meta_lead_id IS NOT NULL;

COMMENT ON COLUMN public.pipeline_leads.meta_lead_id IS
  'leadgen_id do Meta (Facebook Lead Ads). Match determinístico para Conversions API. Preenchido em receive-meta-lead / meta-leads-backfill e via backfill inicial por jetimob_processed.';

COMMENT ON COLUMN public.pipeline_leads.capi_enviado_at IS
  'Timestamp do envio do evento VisitaMarcada ao Meta CAPI. NULL = ainda não enviado. Usado como trava de idempotência no trigger AFTER UPDATE OF stage_id.';