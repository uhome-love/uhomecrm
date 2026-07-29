
CREATE OR REPLACE FUNCTION public.normalize_alias(input text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions
AS $$
  SELECT NULLIF(btrim(regexp_replace(lower(unaccent(coalesce(input,''))), '\s+', ' ', 'g')), '')
$$;

-- Backfill remanescente
UPDATE public.pipeline_leads
SET updated_at = updated_at
WHERE empreendimento_canonico_id IS NULL
  AND created_at > now() - interval '60 days'
  AND (empreendimento IS NOT NULL OR campanha IS NOT NULL OR form_id IS NOT NULL OR form_name IS NOT NULL);
