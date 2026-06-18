CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_oa_leads_telefone_trgm
  ON public.oferta_ativa_leads USING gin (telefone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_oa_leads_telefone2_trgm
  ON public.oferta_ativa_leads USING gin (telefone2 gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_oa_leads_telefone_norm_trgm
  ON public.oferta_ativa_leads USING gin (telefone_normalizado gin_trgm_ops);