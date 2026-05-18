ALTER TABLE public.reengajamento_meta_disparos
  ADD COLUMN IF NOT EXISTS audience_source TEXT;

CREATE INDEX IF NOT EXISTS idx_reengajamento_meta_disparos_audience_source
  ON public.reengajamento_meta_disparos(audience_source);

COMMENT ON COLUMN public.reengajamento_meta_disparos.audience_source IS
  'Origem do disparo: descartados | pipeline_ativo | oferta_ativa_lista | visita_amanha | legacy';