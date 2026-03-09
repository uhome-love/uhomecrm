CREATE OR REPLACE FUNCTION public.distribuir_lead_roleta(
  p_pipeline_lead_id uuid,
  p_segmento_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead pipeline_leads%ROWTYPE;
  v_roleta_segmento_id uuid;
  v_pipeline_segmento_id uuid;
  v_corretor_id uuid;
  v_fila_id uuid;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_sla_minutos int := 10;
BEGIN
  SELECT * INTO v_lead FROM pipeline_leads WHERE id = p_pipeline_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF v_lead.corretor_id IS NOT NULL AND v_lead.aceite_status = 'aceito' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned', 'corretor_id', v_lead.corretor_id);
  END IF;

  v_roleta_segmento_id := p_segmento_id;
  
  IF v_roleta_segmento_id IS NULL AND v_lead.empreendimento IS NOT NULL THEN
    SELECT rc.segmento_id INTO v_roleta_segmento_id
    FROM roleta_campanhas rc
    WHERE UPPER(rc.empreendimento) = UPPER(v_lead.empreendimento)
      AND rc.ativo = true
    LIMIT 1;
  END IF;

  IF v_roleta_segmento_id IS NULL THEN
    UPDATE pipeline_leads SET aceite_status = 'pendente_distribuicao', updated_at = now() WHERE id = p_pipeline_lead_id;
    RETURN jsonb_build_object('success', false, 'reason', 'no_segmento_identified');
  END IF;

  SELECT ps.id INTO v_pipeline_segmento_id
  FROM pipeline_segmentos ps
  JOIN roleta_segmentos rs ON LOWER(TRIM(ps.nome)) = LOWER(TRIM(rs.nome))
  WHERE rs.id = v_roleta_segmento_id
  LIMIT 1;

  SELECT rf.corretor_id, rf.id INTO v_corretor_id, v_fila_id
  FROM roleta_fila rf
  WHERE rf.data = v_today
    AND rf.segmento_id = v_roleta_segmento_id
    AND rf.ativo = true
  ORDER BY COALESCE(rf.leads_recebidos, 0) ASC, rf.posicao ASC
  LIMIT 1;

  IF v_corretor_id IS NULL THEN
    UPDATE pipeline_leads 
    SET aceite_status = 'pendente_distribuicao', updated_at = now()
    WHERE id = p_pipeline_lead_id;
    RETURN jsonb_build_object('success', false, 'reason', 'no_corretor_available', 'segmento_id', v_roleta_segmento_id);
  END IF;

  UPDATE pipeline_leads
  SET corretor_id = v_corretor_id,
      segmento_id = v_pipeline_segmento_id,
      distribuido_em = now(),
      aceite_expira_em = now() + (v_sla_minutos || ' minutes')::interval,
      aceite_status = 'pendente',
      updated_at = now()
  WHERE id = p_pipeline_lead_id;

  UPDATE roleta_fila SET leads_recebidos = COALESCE(leads_recebidos, 0) + 1 WHERE id = v_fila_id;

  INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, segmento_id, acao)
  VALUES (p_pipeline_lead_id, v_corretor_id, v_roleta_segmento_id, 'distribuido');

  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_id', v_corretor_id,
        'title', '🎉 NOVO LEAD! Você tem ' || v_sla_minutos || ' minutos para aceitar.',
        'body', COALESCE(v_lead.nome, 'Lead') || ' - ' || COALESCE(v_lead.empreendimento, ''),
        'url', '/aceite-leads'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'corretor_id', v_corretor_id,
    'segmento_id', v_roleta_segmento_id,
    'pipeline_segmento_id', v_pipeline_segmento_id,
    'sla_minutos', v_sla_minutos
  );
END;
$$