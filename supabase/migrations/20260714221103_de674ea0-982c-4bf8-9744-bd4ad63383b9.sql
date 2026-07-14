
CREATE OR REPLACE FUNCTION public.normalize_telefone(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  WITH d AS (
    SELECT regexp_replace(coalesce(raw, ''), '\D', '', 'g') AS x
  )
  SELECT CASE
    WHEN x = '' THEN NULL
    WHEN length(x) IN (12, 13) AND left(x, 2) = '55' THEN substr(x, 3)
    ELSE x
  END
  FROM d;
$function$;
