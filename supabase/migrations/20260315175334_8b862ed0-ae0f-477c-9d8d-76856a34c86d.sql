ALTER TABLE public.ceo_metas_mensais
  ADD COLUMN IF NOT EXISTS meta_propostas integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_contratos integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_assinados integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_aproveitados integer DEFAULT 0;