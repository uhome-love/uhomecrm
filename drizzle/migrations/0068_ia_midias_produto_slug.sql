ALTER TABLE public.ia_midias ADD COLUMN IF NOT EXISTS produto_slug text;
CREATE INDEX IF NOT EXISTS ia_midias_produto_slug_idx ON public.ia_midias (produto_slug);