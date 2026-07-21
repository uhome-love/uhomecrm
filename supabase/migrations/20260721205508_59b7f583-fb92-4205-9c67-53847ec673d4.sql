
-- 1) Listar textos não resolvidos agrupados
CREATE OR REPLACE FUNCTION public.list_empreendimentos_nao_resolvidos(p_dias INT DEFAULT 30)
RETURNS TABLE(
  texto TEXT,
  tipo TEXT,
  leads_count BIGINT,
  ultimo_lead_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH candidatos AS (
    SELECT NULLIF(trim(campanha), '') AS texto, 'campanha'::text AS tipo, created_at
    FROM public.pipeline_leads
    WHERE created_at > now() - (p_dias || ' days')::interval
      AND empreendimento_canonico_id IS NULL
      AND campanha IS NOT NULL AND trim(campanha) <> ''
    UNION ALL
    SELECT NULLIF(trim(empreendimento), '') AS texto, 'empreendimento_texto'::text, created_at
    FROM public.pipeline_leads
    WHERE created_at > now() - (p_dias || ' days')::interval
      AND empreendimento_canonico_id IS NULL
      AND empreendimento IS NOT NULL AND trim(empreendimento) <> ''
  )
  SELECT c.texto, c.tipo, count(*)::bigint AS leads_count, max(c.created_at) AS ultimo_lead_at
  FROM candidatos c
  WHERE c.texto IS NOT NULL AND length(c.texto) >= 2
  GROUP BY c.texto, c.tipo
  ORDER BY leads_count DESC, ultimo_lead_at DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_empreendimentos_nao_resolvidos(INT) TO authenticated;

-- 2) Vincular alias e fazer backfill
CREATE OR REPLACE FUNCTION public.vincular_alias_com_backfill(
  p_texto TEXT,
  p_tipo TEXT,
  p_empreendimento_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alias_norm TEXT;
  v_backfilled INT := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_texto IS NULL OR length(trim(p_texto)) < 2 THEN
    RAISE EXCEPTION 'texto_invalido';
  END IF;

  IF p_tipo NOT IN ('campanha','conjunto','anuncio','formulario','empreendimento_texto','origem_detalhe') THEN
    RAISE EXCEPTION 'tipo_invalido';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.empreendimentos_canonicos WHERE id = p_empreendimento_id) THEN
    RAISE EXCEPTION 'empreendimento_nao_encontrado';
  END IF;

  v_alias_norm := public.normalize_alias(p_texto);

  -- Inserir alias (ou não duplicar)
  INSERT INTO public.empreendimento_aliases (alias_norm, alias_raw, empreendimento_id, tipo, created_by)
  VALUES (v_alias_norm, p_texto, p_empreendimento_id, p_tipo, auth.uid())
  ON CONFLICT DO NOTHING;

  -- Backfill: força re-resolução dos leads com esse texto sem canônico (últimos 60d)
  IF p_tipo = 'campanha' THEN
    UPDATE public.pipeline_leads
    SET campanha = campanha
    WHERE created_at > now() - interval '60 days'
      AND empreendimento_canonico_id IS NULL
      AND public.normalize_alias(campanha) = v_alias_norm;
  ELSIF p_tipo = 'empreendimento_texto' THEN
    UPDATE public.pipeline_leads
    SET empreendimento = empreendimento
    WHERE created_at > now() - interval '60 days'
      AND empreendimento_canonico_id IS NULL
      AND public.normalize_alias(empreendimento) = v_alias_norm;
  ELSIF p_tipo = 'conjunto' THEN
    UPDATE public.pipeline_leads SET conjunto_anuncio = conjunto_anuncio
    WHERE created_at > now() - interval '60 days'
      AND empreendimento_canonico_id IS NULL
      AND public.normalize_alias(conjunto_anuncio) = v_alias_norm;
  ELSIF p_tipo = 'anuncio' THEN
    UPDATE public.pipeline_leads SET anuncio = anuncio
    WHERE created_at > now() - interval '60 days'
      AND empreendimento_canonico_id IS NULL
      AND public.normalize_alias(anuncio) = v_alias_norm;
  ELSIF p_tipo = 'formulario' THEN
    UPDATE public.pipeline_leads SET formulario = formulario
    WHERE created_at > now() - interval '60 days'
      AND empreendimento_canonico_id IS NULL
      AND public.normalize_alias(formulario) = v_alias_norm;
  ELSIF p_tipo = 'origem_detalhe' THEN
    UPDATE public.pipeline_leads SET origem_detalhe = origem_detalhe
    WHERE created_at > now() - interval '60 days'
      AND empreendimento_canonico_id IS NULL
      AND public.normalize_alias(origem_detalhe) = v_alias_norm;
  END IF;

  GET DIAGNOSTICS v_backfilled = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'alias_norm', v_alias_norm,
    'backfilled_leads', v_backfilled
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.vincular_alias_com_backfill(TEXT, TEXT, UUID) TO authenticated;
