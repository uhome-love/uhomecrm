
CREATE OR REPLACE FUNCTION public.vincular_alias_empreendimento(
  p_alias TEXT,
  p_tipo TEXT,
  p_empreendimento_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alias_norm TEXT;
  v_id UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'gestor')
          OR public.has_role(auth.uid(),'diretor')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF p_tipo NOT IN ('campanha','conjunto','anuncio','formulario','empreendimento_texto','origem_detalhe') THEN
    RAISE EXCEPTION 'Tipo inválido: %', p_tipo;
  END IF;

  v_alias_norm := public.normalize_alias(p_alias);
  IF v_alias_norm IS NULL THEN
    RAISE EXCEPTION 'Alias vazio';
  END IF;

  INSERT INTO public.empreendimento_aliases(alias_norm, alias_raw, empreendimento_id, tipo, created_by)
  VALUES (v_alias_norm, p_alias, p_empreendimento_id, p_tipo, auth.uid())
  ON CONFLICT (alias_norm, tipo) DO UPDATE
    SET empreendimento_id = EXCLUDED.empreendimento_id, alias_raw = EXCLUDED.alias_raw
  RETURNING id INTO v_id;

  -- Reprocessa leads afetados (últimos 180d) que batem com esse alias no campo correspondente
  UPDATE public.pipeline_leads
  SET empreendimento_canonico_id = public.resolver_empreendimento_canonico(
    campanha, conjunto_anuncio, anuncio, formulario, empreendimento, origem_detalhe
  )
  WHERE created_at > now() - interval '180 days'
    AND (
      (p_tipo='campanha'             AND public.normalize_alias(campanha) = v_alias_norm) OR
      (p_tipo='conjunto'             AND public.normalize_alias(conjunto_anuncio) = v_alias_norm) OR
      (p_tipo='anuncio'              AND public.normalize_alias(anuncio) = v_alias_norm) OR
      (p_tipo='formulario'           AND public.normalize_alias(formulario) = v_alias_norm) OR
      (p_tipo='empreendimento_texto' AND public.normalize_alias(empreendimento) = v_alias_norm) OR
      (p_tipo='origem_detalhe'       AND public.normalize_alias(origem_detalhe) = v_alias_norm)
    );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remover_alias_empreendimento(p_alias_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'gestor')
          OR public.has_role(auth.uid(),'diretor')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  DELETE FROM public.empreendimento_aliases WHERE id = p_alias_id;

  -- Reprocessa 180d após remoção
  UPDATE public.pipeline_leads
  SET empreendimento_canonico_id = public.resolver_empreendimento_canonico(
    campanha, conjunto_anuncio, anuncio, formulario, empreendimento, origem_detalhe
  )
  WHERE created_at > now() - interval '180 days';
END;
$$;

GRANT EXECUTE ON FUNCTION public.vincular_alias_empreendimento(TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_alias_empreendimento(UUID) TO authenticated;
