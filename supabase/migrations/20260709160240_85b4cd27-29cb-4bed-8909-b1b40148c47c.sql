ALTER TABLE public.pdn_entries
  ADD COLUMN IF NOT EXISTS grupo_override text,
  ADD COLUMN IF NOT EXISTS corretor_avisado_em timestamptz,
  ADD COLUMN IF NOT EXISTS corretor_avisado_etapa text;