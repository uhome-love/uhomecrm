CREATE OR REPLACE FUNCTION public.resolve_alias_prefixo(p_texto text, p_tipos text[])
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH t AS (SELECT public.normalize_alias(p_texto) AS txt)
  SELECT a.empreendimento_id
  FROM public.empreendimento_aliases a, t
  WHERE t.txt IS NOT NULL
    AND a.tipo = ANY(p_tipos)
    AND length(a.alias_norm) >= 3
    AND left(t.txt, length(a.alias_norm)) = a.alias_norm
    AND (
      length(t.txt) = length(a.alias_norm)
      OR substr(t.txt, length(a.alias_norm) + 1, 1) IN (' ', '-', '_', '|', '/', ':', '.', ',')
    )
  ORDER BY length(a.alias_norm) DESC
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.resolve_empreendimento_canonico(p_form_id text, p_form_name text, p_campanha text, p_empreendimento text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  -- 1. form_id exato
  IF p_form_id IS NOT NULL AND length(btrim(p_form_id)) > 0 THEN
    SELECT empreendimento_id INTO v_id
    FROM empreendimento_aliases
    WHERE tipo = 'formulario' AND alias_raw = p_form_id
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  -- 2. form_name normalizado
  IF p_form_name IS NOT NULL AND length(btrim(p_form_name)) > 0 THEN
    SELECT empreendimento_id INTO v_id
    FROM empreendimento_aliases
    WHERE tipo = 'formulario' AND alias_norm = normalize_alias(p_form_name)
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  -- 3. empreendimento texto (mais confiável que campanha)
  IF p_empreendimento IS NOT NULL AND length(btrim(p_empreendimento)) > 0 THEN
    SELECT empreendimento_id INTO v_id
    FROM empreendimento_aliases
    WHERE tipo = 'empreendimento_texto' AND alias_norm = normalize_alias(p_empreendimento)
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;

    SELECT id INTO v_id
    FROM empreendimentos_canonicos
    WHERE normalize_alias(nome) = normalize_alias(p_empreendimento)
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  -- 4. campanha
  IF p_campanha IS NOT NULL AND length(btrim(p_campanha)) > 0 THEN
    SELECT empreendimento_id INTO v_id
    FROM empreendimento_aliases
    WHERE tipo = 'campanha' AND alias_norm = normalize_alias(p_campanha)
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;

    SELECT empreendimento_id INTO v_id
    FROM empreendimento_aliases
    WHERE tipo = 'empreendimento_texto' AND alias_norm = normalize_alias(p_campanha)
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  -- 5. fallback por PREFIXO (ex.: "AWA - Preview v1" -> alias "awa")
  v_id := public.resolve_alias_prefixo(p_empreendimento, ARRAY['empreendimento_texto','campanha']);
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  v_id := public.resolve_alias_prefixo(p_campanha, ARRAY['campanha','empreendimento_texto']);
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  v_id := public.resolve_alias_prefixo(p_form_name, ARRAY['formulario']);
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolver_empreendimento_canonico(p_campanha text, p_conjunto text, p_anuncio text, p_formulario text, p_empreendimento text, p_origem_detalhe text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  SELECT empreendimento_id INTO v_id
  FROM public.empreendimento_aliases
  WHERE alias_norm = public.normalize_alias(p_campanha) AND tipo='campanha'
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT empreendimento_id INTO v_id
  FROM public.empreendimento_aliases
  WHERE alias_norm = public.normalize_alias(p_conjunto) AND tipo='conjunto'
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT empreendimento_id INTO v_id
  FROM public.empreendimento_aliases
  WHERE alias_norm = public.normalize_alias(p_anuncio) AND tipo='anuncio'
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT empreendimento_id INTO v_id
  FROM public.empreendimento_aliases
  WHERE alias_norm = public.normalize_alias(p_formulario) AND tipo='formulario'
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT empreendimento_id INTO v_id
  FROM public.empreendimento_aliases
  WHERE alias_norm = public.normalize_alias(p_empreendimento) AND tipo='empreendimento_texto'
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT empreendimento_id INTO v_id
  FROM public.empreendimento_aliases
  WHERE alias_norm = public.normalize_alias(p_origem_detalhe) AND tipo='origem_detalhe'
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- fallback por PREFIXO (mesma prioridade da cascata acima)
  v_id := public.resolve_alias_prefixo(p_campanha, ARRAY['campanha','empreendimento_texto']);
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  v_id := public.resolve_alias_prefixo(p_conjunto, ARRAY['conjunto']);
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  v_id := public.resolve_alias_prefixo(p_anuncio, ARRAY['anuncio']);
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  v_id := public.resolve_alias_prefixo(p_formulario, ARRAY['formulario']);
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  v_id := public.resolve_alias_prefixo(p_empreendimento, ARRAY['empreendimento_texto','campanha']);
  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_alias_prefixo(text, text[]) TO authenticated, service_role;