-- Add missing columns to pipeline_leads for site webhook data
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS dados_site jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tipo_acao text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS origem_ref text DEFAULT NULL;

-- Add slug_ref to profiles if missing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS slug_ref text DEFAULT NULL;

-- Add unique index on slug_ref for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_slug_ref ON public.profiles (slug_ref) WHERE slug_ref IS NOT NULL;

COMMENT ON COLUMN public.pipeline_leads.dados_site IS 'Payload completo recebido do site uhome.com.br';
COMMENT ON COLUMN public.pipeline_leads.tipo_acao IS 'Tipo da ação: lead, agendamento, captacao, whatsapp_click';
COMMENT ON COLUMN public.pipeline_leads.origem_ref IS 'Referência de origem: link_corretor ou organico';
COMMENT ON COLUMN public.profiles.slug_ref IS 'Slug do corretor para links personalizados do site';