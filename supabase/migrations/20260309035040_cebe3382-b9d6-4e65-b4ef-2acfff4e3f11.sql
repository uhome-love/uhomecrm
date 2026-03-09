
-- TODO: TEMPORÁRIO - dia de teste 09/03. Reverter depois.
-- Change default SLA from 5 to 10 minutes for lead acceptance
CREATE OR REPLACE FUNCTION public.distribuir_lead_roleta(p_pipeline_lead_id uuid, p_segmento_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead pipeline_leads%ROWTYPE;
  v_segmento_id uuid;
  v_segmento pipeline_segmentos%ROWTYPE;
  v_corretor_id uuid;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_now_time time := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
  v_active_count int;
  v_sla_minutos int;
  v_max_leads int;
BEGIN
  SELECT * INTO v_lead FROM pipeline_leads WHERE id = p_pipeline_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF v_lead.corretor_id IS NOT NULL AND v_lead.aceite_status = 'aceito' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned', 'corretor_id', v_lead.corretor_id);
  END IF;

  v_segmento_id := COALESCE(p_segmento_id, v_lead.segmento_id);
  
  IF v_segmento_id IS NULL AND v_lead.empreendimento IS NOT NULL THEN
    SELECT sc.segmento_id INTO v_segmento_id
    FROM segmento_campanhas sc
    WHERE UPPER(sc.campanha_nome) = UPPER(v_lead.empreendimento)
    LIMIT 1;
  END IF;

  IF v_segmento_id IS NULL THEN
    UPDATE pipeline_leads SET aceite_status = 'pendente_distribuicao' WHERE id = p_pipeline_lead_id;
    RETURN jsonb_build_object('success', false, 'reason', 'no_segmento_identified');
  END IF;

  SELECT * INTO v_segmento FROM pipeline_segmentos WHERE id = v_segmento_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'segmento_not_found');
  END IF;

  -- TODO: TEMPORÁRIO - dia de teste 09/03. Reverter default para 5 depois.
  v_sla_minutos := COALESCE(v_segmento.sla_minutos, 10);
  v_max_leads := COALESCE(v_segmento.max_leads_ativos, 3);

  IF v_segmento.roleta_inicio IS NOT NULL AND v_segmento.roleta_fim IS NOT NULL THEN
    IF v_now_time < v_segmento.roleta_inicio OR v_now_time > v_segmento.roleta_fim THEN
      UPDATE pipeline_leads 
      SET aceite_status = 'pendente_distribuicao',
          segmento_id = v_segmento_id,
          updated_at = now()
      WHERE id = p_pipeline_lead_id;
      RETURN jsonb_build_object('success', false, 'reason', 'fora_horario', 'horario_inicio', v_segmento.roleta_inicio, 'horario_fim', v_segmento.roleta_fim);
    END IF;
  END IF;

  SELECT de.corretor_id INTO v_corretor_id
  FROM distribuicao_escala de
  WHERE de.data = v_today
    AND de.segmento_id = v_segmento_id
    AND de.ativo = true
    AND de.aprovacao_status = 'aprovado'
    AND EXISTS (
      SELECT 1 FROM corretor_disponibilidade cd
      WHERE cd.user_id = de.corretor_id
        AND cd.status = 'na_empresa'
        AND cd.na_roleta = true
    )
    AND (
      SELECT COUNT(*) FROM pipeline_leads pl
      JOIN pipeline_stages ps ON ps.id = pl.stage_id
      WHERE pl.corretor_id = de.corretor_id
        AND ps.tipo NOT IN ('venda', 'descarte')
        AND pl.aceite_status IN ('pendente', 'aceito')
    ) < v_max_leads
  ORDER BY
    (SELECT COUNT(*) FROM distribuicao_historico dh
     WHERE dh.corretor_id = de.corretor_id
       AND dh.created_at >= (v_today::text || 'T00:00:00-03:00')::timestamptz) ASC,
    random()
  LIMIT 1;

  IF v_corretor_id IS NULL THEN
    UPDATE pipeline_leads 
    SET aceite_status = 'pendente_distribuicao',
        segmento_id = v_segmento_id,
        updated_at = now()
    WHERE id = p_pipeline_lead_id;
    RETURN jsonb_build_object('success', false, 'reason', 'no_corretor_available', 'segmento_id', v_segmento_id);
  END IF;

  UPDATE pipeline_leads
  SET corretor_id = v_corretor_id,
      segmento_id = v_segmento_id,
      distribuido_em = now(),
      aceite_expira_em = now() + (v_sla_minutos || ' minutes')::interval,
      aceite_status = 'pendente',
      updated_at = now()
  WHERE id = p_pipeline_lead_id;

  INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, segmento_id, acao)
  VALUES (p_pipeline_lead_id, v_corretor_id, v_segmento_id, 'distribuido');

  -- Send push notification
  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_id', v_corretor_id,
        'title', '🎉 NOVO LEAD! Você tem ' || v_sla_minutos || ' minutos para aceitar, abre aqui.',
        'body', COALESCE(v_lead.nome, 'Lead') || ' — ' || COALESCE(v_lead.empreendimento, 'Sem empreendimento') || '. Aceite agora!',
        'url', '/aceite'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Create in-app notification
  BEGIN
    INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, dados, agrupamento_key)
    VALUES (
      v_corretor_id, 'leads', 'novo_lead_distribuido',
      '🎉 NOVO LEAD! Aceite em ' || v_sla_minutos || ' min',
      COALESCE(v_lead.nome, 'Lead') || ' — ' || COALESCE(v_lead.empreendimento, ''),
      jsonb_build_object('pipeline_lead_id', p_pipeline_lead_id, 'empreendimento', v_lead.empreendimento),
      'novo_lead_' || p_pipeline_lead_id::text
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'corretor_id', v_corretor_id,
    'segmento_id', v_segmento_id,
    'sla_minutos', v_sla_minutos
  );
END;
$function$;
