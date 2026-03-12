
ALTER TABLE public.vitrines 
  ADD COLUMN IF NOT EXISTS subtitulo text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS tema_visual text DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS hero_url text,
  ADD COLUMN IF NOT EXISTS cliques_whatsapp integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create unique index on slug (nullable - only enforced when set)
CREATE UNIQUE INDEX IF NOT EXISTS vitrines_slug_unique ON public.vitrines (slug) WHERE slug IS NOT NULL;

-- Update existing types to new naming
UPDATE public.vitrines SET tipo = 'product_page' WHERE tipo = 'anuncio';
UPDATE public.vitrines SET tipo = 'property_selection' WHERE tipo = 'jetimob';
-- melnick_day stays as is
