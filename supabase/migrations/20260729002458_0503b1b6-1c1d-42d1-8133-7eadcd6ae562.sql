
CREATE OR REPLACE FUNCTION public.resolve_empreendimento_canonico(
  p_form_id text,
  p_form_name text,
  p_campanha text,
  p_empreendimento text
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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

  RETURN NULL;
END;
$$;

-- Reforça: os 2 leads "The Arch" / "The arch " precisam sair de Flow
UPDATE public.pipeline_leads SET empreendimento_canonico_id = NULL
WHERE empreendimento ILIKE 'The arch%' AND empreendimento_canonico_id IS NOT NULL;

-- reprocessa
UPDATE public.pipeline_leads
SET updated_at = updated_at
WHERE empreendimento_canonico_id IS NULL
  AND created_at > now() - interval '60 days'
  AND (empreendimento IS NOT NULL OR campanha IS NOT NULL OR form_id IS NOT NULL OR form_name IS NOT NULL);
