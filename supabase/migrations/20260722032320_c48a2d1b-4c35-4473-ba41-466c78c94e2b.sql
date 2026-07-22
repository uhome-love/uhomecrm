CREATE INDEX IF NOT EXISTS idx_pipeline_atividades_lead_created ON public.pipeline_atividades (pipeline_lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visita_eventos_lead_created ON public.visita_eventos (pipeline_lead_id, created_at DESC);
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_leads;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.visita_eventos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;