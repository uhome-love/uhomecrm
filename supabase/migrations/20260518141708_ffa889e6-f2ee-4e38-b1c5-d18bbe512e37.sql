ALTER TABLE public.reengajamento_eventos
  ADD COLUMN IF NOT EXISTS audience_source TEXT;

ALTER TABLE public.reengajamento_dispatch_runs
  ADD COLUMN IF NOT EXISTS audience_source TEXT,
  ADD COLUMN IF NOT EXISTS audience_payload JSONB;

CREATE INDEX IF NOT EXISTS idx_reeng_eventos_audience
  ON public.reengajamento_eventos (lead_id, audience_source, created_at DESC)
  WHERE audience_source IS NOT NULL;