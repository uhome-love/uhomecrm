CREATE OR REPLACE FUNCTION public.unaccent_immutable(_txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT translate(
    coalesce(_txt, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$$;

CREATE OR REPLACE FUNCTION public.normalizar_bairro(_txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    lower(btrim(public.unaccent_immutable(coalesce(_txt, '')))),
    '[^a-z0-9]+', ' ', 'g'
  );
$$;

CREATE TABLE IF NOT EXISTS public.bairros_zonas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bairro text NOT NULL,
  bairro_norm text NOT NULL,
  zona text NOT NULL,
  cidade text NOT NULL DEFAULT 'Porto Alegre',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bairros_zonas_bairro_norm_key UNIQUE (bairro_norm)
);

GRANT SELECT ON public.bairros_zonas TO authenticated;
GRANT ALL ON public.bairros_zonas TO service_role;

ALTER TABLE public.bairros_zonas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bairros_zonas_select" ON public.bairros_zonas;
CREATE POLICY "bairros_zonas_select" ON public.bairros_zonas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "bairros_zonas_manage" ON public.bairros_zonas
;
CREATE POLICY "bairros_zonas_manage" ON public.bairros_zonas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE INDEX IF NOT EXISTS idx_bairros_zonas_zona ON public.bairros_zonas (zona);

CREATE OR REPLACE FUNCTION public.trg_bairros_zonas_norm()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.bairro_norm := public.normalizar_bairro(NEW.bairro);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bairros_zonas_norm ON public.bairros_zonas;
CREATE TRIGGER bairros_zonas_norm
  BEFORE INSERT OR UPDATE ON public.bairros_zonas
  FOR EACH ROW EXECUTE FUNCTION public.trg_bairros_zonas_norm();

CREATE OR REPLACE FUNCTION public.trg_properties_set_regiao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _zona text;
BEGIN
  IF NEW.bairro IS NULL OR btrim(NEW.bairro) = '' THEN
    NEW.regiao := NULL;
    RETURN NEW;
  END IF;

  SELECT bz.zona INTO _zona
  FROM public.bairros_zonas bz
  WHERE bz.bairro_norm = public.normalizar_bairro(NEW.bairro)
  LIMIT 1;

  NEW.regiao := _zona;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS properties_set_regiao ON public.properties;
CREATE TRIGGER properties_set_regiao
  BEFORE INSERT OR UPDATE OF bairro ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.trg_properties_set_regiao();