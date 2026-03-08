-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_oa_leads_lista_status ON public.oferta_ativa_leads(lista_id, status);
CREATE INDEX IF NOT EXISTS idx_oa_leads_telefone_norm ON public.oferta_ativa_leads(telefone_normalizado);
CREATE INDEX IF NOT EXISTS idx_oa_leads_corretor ON public.oferta_ativa_leads(corretor_id) WHERE corretor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oa_tentativas_corretor_date ON public.oferta_ativa_tentativas(corretor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_corretor ON public.pipeline_leads(corretor_id) WHERE corretor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_stage ON public.pipeline_leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_visitas_corretor_data ON public.visitas(corretor_id, data_visita);
CREATE INDEX IF NOT EXISTS idx_checkpoint_lines_composite ON public.checkpoint_lines(checkpoint_id, corretor_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);