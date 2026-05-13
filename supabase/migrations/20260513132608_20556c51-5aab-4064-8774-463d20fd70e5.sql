
ALTER TABLE public.reengajamento_config
  ADD COLUMN IF NOT EXISTS mensagem_template_2 TEXT,
  ADD COLUMN IF NOT EXISTS meta_template_name_2 TEXT,
  ADD COLUMN IF NOT EXISTS mensagens_variantes_2 TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS wave2_min_dias_apos_wave1 INT DEFAULT 5;

ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS reengajamento_wave2_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pl_reengaj_wave2
  ON public.pipeline_leads(reengajamento_status, reengajamento_wave2_at)
  WHERE reengajamento_status IN ('enviado','enviado_wave2');
