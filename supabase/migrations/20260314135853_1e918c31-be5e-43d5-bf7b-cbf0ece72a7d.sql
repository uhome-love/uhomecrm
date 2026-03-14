
ALTER TABLE public.empreendimento_overrides
  ADD COLUMN IF NOT EXISTS descricao_completa text,
  ADD COLUMN IF NOT EXISTS objecoes jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS estrategia_conversao text,
  ADD COLUMN IF NOT EXISTS perfil_cliente text,
  ADD COLUMN IF NOT EXISTS hashtags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS argumentos_venda text,
  ADD COLUMN IF NOT EXISTS segmento_comercial text;

COMMENT ON COLUMN public.empreendimento_overrides.descricao_completa IS 'Full AI-oriented sales narrative for assistants';
COMMENT ON COLUMN public.empreendimento_overrides.objecoes IS 'JSON array of {objecao, resposta} for AI objection handling';
COMMENT ON COLUMN public.empreendimento_overrides.estrategia_conversao IS 'Step-by-step conversion strategy for AI coaching';
COMMENT ON COLUMN public.empreendimento_overrides.perfil_cliente IS 'Ideal client profile description for AI targeting';
COMMENT ON COLUMN public.empreendimento_overrides.hashtags IS 'Marketing hashtags for social media AI';
COMMENT ON COLUMN public.empreendimento_overrides.argumentos_venda IS 'Key selling arguments for AI prompts';
COMMENT ON COLUMN public.empreendimento_overrides.segmento_comercial IS 'Commercial segment: mcmv, medio_alto, altissimo, investimento';
