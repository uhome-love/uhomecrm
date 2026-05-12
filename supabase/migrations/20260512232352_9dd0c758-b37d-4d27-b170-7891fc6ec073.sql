
CREATE OR REPLACE FUNCTION public.auto_arquivar_descartes_24h()
RETURNS TABLE(arquivados_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_descarte_stage_id uuid;
  v_count integer := 0;
  v_lead record;
BEGIN
  SELECT id INTO v_descarte_stage_id
  FROM pipeline_stages
  WHERE nome ILIKE 'Descarte'
  LIMIT 1;

  IF v_descarte_stage_id IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  FOR v_lead IN
    SELECT id, corretor_id
    FROM pipeline_leads
    WHERE stage_id = v_descarte_stage_id
      AND (arquivado IS NULL OR arquivado = false)
      AND COALESCE(motivo_descarte, '') NOT ILIKE 'Inativado:%'
      AND data_entrada_etapa < (now() - interval '24 hours')
  LOOP
    UPDATE pipeline_leads
    SET arquivado = true,
        updated_at = now()
    WHERE id = v_lead.id;

    INSERT INTO pipeline_historico (lead_id, acao, descricao, movido_por, created_at)
    VALUES (
      v_lead.id,
      'arquivamento_automatico',
      'Lead arquivado automaticamente após 24h em Descarte (segue disponível para nutrição e oferta ativa)',
      v_lead.corretor_id,
      now()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$$;
