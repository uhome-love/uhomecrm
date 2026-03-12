ALTER TABLE public.pipeline_leads 
ADD COLUMN IF NOT EXISTS campanha text,
ADD COLUMN IF NOT EXISTS campanha_id text,
ADD COLUMN IF NOT EXISTS conjunto_anuncio text,
ADD COLUMN IF NOT EXISTS anuncio text,
ADD COLUMN IF NOT EXISTS formulario text,
ADD COLUMN IF NOT EXISTS plataforma text;