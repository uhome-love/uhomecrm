
-- Add tipo and negocio_id columns to visitas table
ALTER TABLE public.visitas 
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'lead',
  ADD COLUMN IF NOT EXISTS negocio_id UUID REFERENCES public.negocios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_reuniao TEXT;

-- Add comment
COMMENT ON COLUMN public.visitas.tipo IS 'lead or negocio - distinguishes visit type';
COMMENT ON COLUMN public.visitas.negocio_id IS 'FK to negocios for business meetings';
COMMENT ON COLUMN public.visitas.tipo_reuniao IS 'For negocio visits: fechamento, negociacao, assinatura, outro';
