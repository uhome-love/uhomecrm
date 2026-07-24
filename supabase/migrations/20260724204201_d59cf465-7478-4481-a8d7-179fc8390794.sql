
ALTER TABLE public.oferta_ativa_listas
  ADD COLUMN IF NOT EXISTS empreendimento_canonico_id UUID REFERENCES public.empreendimentos_canonicos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'empreendimento';

CREATE INDEX IF NOT EXISTS idx_oa_listas_canonico ON public.oferta_ativa_listas(empreendimento_canonico_id);
