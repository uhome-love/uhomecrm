
ALTER TABLE public.empreendimento_overrides 
  ADD COLUMN IF NOT EXISTS tipologias jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS valor_min numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_max numeric DEFAULT NULL;
