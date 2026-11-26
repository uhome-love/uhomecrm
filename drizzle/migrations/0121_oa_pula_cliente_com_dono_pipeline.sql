CREATE OR REPLACE FUNCTION public.oa_telefone_com_dono_pipeline(p_tel text, p_tel2 text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT EXISTS (
    SELECT 1 FROM public.pipeline_leads pl
    WHERE pl.corretor_id IS NOT NULL AND pl.arquivado = false
      AND pl.stage_id <> '1dd66c25-3848-4053-9f66-82e902989b4d'
      AND length(regexp_replace(coalesce(pl.telefone,''),'\D','','g')) >= 8
      AND right(regexp_replace(pl.telefone,'\D','','g'),8) IN (
        nullif(right(regexp_replace(coalesce(p_tel,''),'\D','','g'),8),''),
        nullif(right(regexp_replace(coalesce(p_tel2,''),'\D','','g'),8),''))
  );
$f$;
REVOKE ALL ON FUNCTION public.oa_telefone_com_dono_pipeline(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oa_telefone_com_dono_pipeline(text,text) TO authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_tel8_ativo ON public.pipeline_leads ((right(regexp_replace(telefone,'\D','','g'),8))) WHERE corretor_id IS NOT NULL AND arquivado = false;

CREATE OR REPLACE FUNCTION public.fetch_next_lead(p_corretor_id uuid, p_lista_id uuid, p_lock_minutes integer DEFAULT 5, p_empreendimentos text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead oferta_ativa_leads%ROWTYPE;
  v_now timestamptz := now();
  v_today_start timestamptz := date_trunc('day', v_now AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  v_lock_until timestamptz := v_now + (p_lock_minutes || ' minutes')::interval;
  v_phones_worked text[];
  v_emps text[] := CASE WHEN p_empreendimentos IS NULL OR cardinality(p_empreendimentos) = 0 THEN NULL ELSE p_empreendimentos END;
BEGIN
  PERFORM public.assert_acts_as(p_corretor_id);
  UPDATE oferta_ativa_leads SET em_atendimento_por = NULL, em_atendimento_ate = NULL
  WHERE em_atendimento_ate < v_now AND em_atendimento_por IS NOT NULL;

  SELECT array_agg(DISTINCT l.telefone_normalizado) INTO v_phones_worked
  FROM oferta_ativa_tentativas t JOIN oferta_ativa_leads l ON l.id = t.lead_id
  WHERE t.corretor_id = p_corretor_id AND t.created_at >= v_today_start AND l.telefone_normalizado IS NOT NULL;

  SELECT l.* INTO v_lead FROM oferta_ativa_leads l
  WHERE l.lista_id = p_lista_id
    AND (v_emps IS NULL OR COALESCE(l.empreendimento,'') = ANY(v_emps))
    AND l.status IN ('na_fila', 'em_cooldown') AND NOT public.contato_bloqueado(l.telefone) AND NOT public.oa_telefone_com_dono_pipeline(l.telefone, l.telefone2) AND (nullif(trim(l.telefone2),'') IS NULL OR NOT public.contato_bloqueado(l.telefone2))
    AND (l.proxima_tentativa_apos IS NULL OR l.proxima_tentativa_apos <= v_now)
    AND (l.em_atendimento_por IS NULL OR l.em_atendimento_por = p_corretor_id OR l.em_atendimento_ate < v_now)
    AND NOT EXISTS (SELECT 1 FROM oferta_ativa_tentativas t WHERE t.lead_id = l.id AND t.corretor_id = p_corretor_id AND t.created_at >= v_today_start)
    AND (l.telefone_normalizado IS NULL OR v_phones_worked IS NULL OR NOT (l.telefone_normalizado = ANY(v_phones_worked)))
  ORDER BY l.tentativas_count ASC, EXTRACT(EPOCH FROM (v_now - COALESCE(l.ultima_tentativa, l.created_at))) DESC, random()
  LIMIT 1 FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    SELECT l.* INTO v_lead FROM oferta_ativa_leads l
    WHERE l.lista_id = p_lista_id
      AND (v_emps IS NULL OR COALESCE(l.empreendimento,'') = ANY(v_emps))
      AND l.status IN ('na_fila', 'em_cooldown') AND NOT public.contato_bloqueado(l.telefone) AND NOT public.oa_telefone_com_dono_pipeline(l.telefone, l.telefone2) AND (nullif(trim(l.telefone2),'') IS NULL OR NOT public.contato_bloqueado(l.telefone2))
      AND (l.proxima_tentativa_apos IS NULL OR l.proxima_tentativa_apos <= v_now)
      AND (l.em_atendimento_por IS NULL OR l.em_atendimento_por = p_corretor_id OR l.em_atendimento_ate < v_now)
    ORDER BY l.tentativas_count ASC, random()
    LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('found', false, 'reason', 'no_leads_available');
    END IF;
  END IF;

  UPDATE oferta_ativa_leads SET em_atendimento_por = p_corretor_id, em_atendimento_ate = v_lock_until WHERE id = v_lead.id;

  INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, metadata)
  VALUES ('lead_served', p_corretor_id, v_lead.id, p_lista_id,
    jsonb_build_object('tentativas_count', v_lead.tentativas_count, 'status', v_lead.status, 'filtro_empreendimentos', v_emps));

  RETURN jsonb_build_object('found', true,
    'lead', jsonb_build_object('id', v_lead.id, 'nome', v_lead.nome, 'telefone', v_lead.telefone, 'telefone2', v_lead.telefone2,
      'email', v_lead.email, 'empreendimento', v_lead.empreendimento, 'campanha', v_lead.campanha, 'origem', v_lead.origem,
      'data_lead', v_lead.data_lead, 'observacoes', v_lead.observacoes, 'tentativas_count', v_lead.tentativas_count,
      'lista_id', v_lead.lista_id, 'status', v_lead.status),
    'lock_expires_at', v_lock_until);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fetch_next_lead_campaign(p_corretor_id uuid, p_lista_ids uuid[], p_lock_minutes integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead oferta_ativa_leads%ROWTYPE;
  v_now timestamptz := now();
  v_today_start timestamptz := date_trunc('day', v_now AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  v_lock_until timestamptz := v_now + (p_lock_minutes || ' minutes')::interval;
  v_phones_worked text[];
BEGIN
  PERFORM public.assert_acts_as(p_corretor_id);
  UPDATE oferta_ativa_leads
  SET em_atendimento_por = NULL, em_atendimento_ate = NULL
  WHERE em_atendimento_ate < v_now AND em_atendimento_por IS NOT NULL;

  SELECT array_agg(DISTINCT l.telefone_normalizado)
  INTO v_phones_worked
  FROM oferta_ativa_tentativas t
  JOIN oferta_ativa_leads l ON l.id = t.lead_id
  WHERE t.corretor_id = p_corretor_id
    AND t.created_at >= v_today_start
    AND l.telefone_normalizado IS NOT NULL;

  SELECT l.* INTO v_lead
  FROM oferta_ativa_leads l
  WHERE l.lista_id = ANY(p_lista_ids)
    AND l.status IN ('na_fila', 'em_cooldown') AND NOT public.contato_bloqueado(l.telefone) AND NOT public.oa_telefone_com_dono_pipeline(l.telefone, l.telefone2) AND (nullif(trim(l.telefone2),'') IS NULL OR NOT public.contato_bloqueado(l.telefone2))
    AND (l.proxima_tentativa_apos IS NULL OR l.proxima_tentativa_apos <= v_now)
    AND (l.em_atendimento_por IS NULL OR l.em_atendimento_por = p_corretor_id OR l.em_atendimento_ate < v_now)
    AND NOT EXISTS (
      SELECT 1 FROM oferta_ativa_tentativas t
      WHERE t.lead_id = l.id
        AND t.corretor_id = p_corretor_id
        AND t.created_at >= v_today_start
    )
    AND (l.telefone_normalizado IS NULL OR v_phones_worked IS NULL OR NOT (l.telefone_normalizado = ANY(v_phones_worked)))
  ORDER BY
    l.tentativas_count ASC,
    EXTRACT(EPOCH FROM (v_now - COALESCE(l.ultima_tentativa, l.created_at))) DESC,
    random()
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    SELECT l.* INTO v_lead
    FROM oferta_ativa_leads l
    WHERE l.lista_id = ANY(p_lista_ids)
      AND l.status IN ('na_fila', 'em_cooldown') AND NOT public.contato_bloqueado(l.telefone) AND NOT public.oa_telefone_com_dono_pipeline(l.telefone, l.telefone2) AND (nullif(trim(l.telefone2),'') IS NULL OR NOT public.contato_bloqueado(l.telefone2))
      AND (l.proxima_tentativa_apos IS NULL OR l.proxima_tentativa_apos <= v_now)
      AND (l.em_atendimento_por IS NULL OR l.em_atendimento_por = p_corretor_id OR l.em_atendimento_ate < v_now)
    ORDER BY l.tentativas_count ASC, random()
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('found', false, 'reason', 'no_leads_available');
    END IF;
  END IF;

  UPDATE oferta_ativa_leads
  SET em_atendimento_por = p_corretor_id,
      em_atendimento_ate = v_lock_until
  WHERE id = v_lead.id;

  INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, metadata)
  VALUES ('lead_served', p_corretor_id, v_lead.id, v_lead.lista_id,
    jsonb_build_object('tentativas_count', v_lead.tentativas_count, 'status', v_lead.status, 'campaign_mode', true));

  RETURN jsonb_build_object(
    'found', true,
    'lead', jsonb_build_object(
      'id', v_lead.id,
      'nome', v_lead.nome,
      'telefone', v_lead.telefone,
      'telefone2', v_lead.telefone2,
      'email', v_lead.email,
      'empreendimento', v_lead.empreendimento,
      'campanha', v_lead.campanha,
      'origem', v_lead.origem,
      'data_lead', v_lead.data_lead,
      'observacoes', v_lead.observacoes,
      'tentativas_count', v_lead.tentativas_count,
      'lista_id', v_lead.lista_id,
      'status', v_lead.status
    ),
    'lock_expires_at', v_lock_until
  );
END;
$function$;