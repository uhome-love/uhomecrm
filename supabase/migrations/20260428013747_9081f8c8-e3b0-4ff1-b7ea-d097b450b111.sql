-- 1. Schema additions
ALTER TABLE public.oferta_ativa_listas
  ADD COLUMN IF NOT EXISTS segmento_id uuid REFERENCES public.roleta_segmentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ultima_higienizacao_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_oferta_ativa_listas_segmento_id
  ON public.oferta_ativa_listas(segmento_id);

-- 2. Helper: normalize string (lower + remove common Portuguese accents)
CREATE OR REPLACE FUNCTION public.norm_empreendimento(s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(translate(coalesce(s, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')))
$$;

-- 3. Backfill exact match
UPDATE public.oferta_ativa_listas l
SET segmento_id = rc.segmento_id
FROM public.roleta_campanhas rc
WHERE l.segmento_id IS NULL
  AND l.empreendimento IS NOT NULL
  AND public.norm_empreendimento(l.empreendimento) = public.norm_empreendimento(rc.empreendimento)
  AND rc.ativo = true;

-- 4. Backfill partial match (e.g. "Botanique - Me Day" contains "Me Day")
UPDATE public.oferta_ativa_listas l
SET segmento_id = rc.segmento_id
FROM public.roleta_campanhas rc
WHERE l.segmento_id IS NULL
  AND l.empreendimento IS NOT NULL
  AND rc.ativo = true
  AND length(rc.empreendimento) >= 4
  AND public.norm_empreendimento(l.empreendimento) ILIKE '%' || public.norm_empreendimento(rc.empreendimento) || '%';