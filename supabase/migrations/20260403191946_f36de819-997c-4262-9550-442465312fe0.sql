CREATE OR REPLACE FUNCTION public.distribuir_lead_atomico(
  p_lead_id UUID,
  p_janela TEXT DEFAULT NULL,
  p_exclude_auth_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_segmento_id UUID;
  v_ignora_segmento BOOLEAN := FALSE;
  v_target_janela TEXT;
  v_today_date DATE;
  v_today_start TIMESTAMPTZ;
  v_janela_start TIMESTAMPTZ;
  v_is_sunday BOOLEAN;
  v_is_holiday BOOLEAN := FALSE;
  v_chosen_profile_id UUID;
  v_chosen_auth_id UUID;
  v_now TIMESTAMPTZ := now();
  v_expire_at TIMESTAMPTZ;
  v_emp_lower TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('distribuir_lead_atomico'));

  SELECT id, nome, telefone, empreendimento, aceite_status, corretor_id, origem
  INTO v_lead
  FROM public.pipeline_leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF v_lead IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF v_lead.corretor_id IS NOT NULL AND v_lead.aceite_status != 'pendente_distribuicao' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;

  v_emp_lower := lower(trim(COALESCE(v_lead.empreendimento, '')));
  IF v_emp_lower != '' THEN
    SELECT segmento_id, COALESCE(ignorar_segmento, false)
    INTO v_segmento_id, v_ignora_segmento
    FROM public.roleta_campanhas
    WHERE ativo = true
      AND (
        lower(trim(empreendimento)) = v_emp_lower
        OR v_emp_lower LIKE '%' || lower(trim(empreendimento)) || '%'
        OR lower(trim(empreendimento)) LIKE '%' || v_emp_lower || '%'
      )
    LIMIT 1;

    IF v_ignora_segmento THEN
      v_segmento_id := NULL;
    END IF;
  END IF;

  v_today_date := (v_now AT TIME ZONE 'America/Sao_Paulo')::date;
  v_today_start := (date_trunc('day', v_now AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo';
  v_is_sunday := EXTRACT(DOW FROM (v_now AT TIME ZONE 'America/Sao_Paulo')) = 0;
  v_is_holiday := v_today_date IN ('2026-04-03'::date);

  IF v_is_sunday OR v_is_holiday THEN
    v_target_janela := 'dia_todo';
  ELSIF p_janela IS NOT NULL AND p_janela <> 'qualquer' THEN
    v_target_janela := p_janela;
  ELSE
    IF EXTRACT(HOUR FROM (v_now AT TIME ZONE 'America/Sao_Paulo')) < 13 THEN
      v_target_janela := 'manha';
    ELSIF EXTRACT(HOUR FROM (v_now AT TIME ZONE 'America/Sao_Paulo')) < 19 THEN
      v_target_janela := 'tarde';
    ELSE
      v_target_janela := 'noturna';
    END IF;
  END IF;

  IF v_target_janela = 'manha' THEN
    v_janela_start := v_today_start + interval '8 hours';
  ELSIF v_target_janela = 'tarde' THEN
    v_janela_start := v_today_start + interval '13 hours';
  ELSIF v_target_janela = 'noturna' THEN
    v_janela_start := v_today_start + interval '19 hours';
  ELSE
    v_janela_start := v_today_start;
  END IF;

  v_expire_at := v_now + interval '10 minutes';

  SELECT c.corretor_id, p.user_id
  INTO v_chosen_profile_id, v_chosen_auth_id
  FROM public.roleta_credenciamentos c
  JOIN public.profiles p ON p.id = c.corretor_id
  WHERE c.data = v_today_date
    AND c.status = 'aprovado'
    AND c.saiu_em IS NULL
    AND p.user_id IS NOT NULL
    AND (
      (v_is_sunday OR v_is_holiday)
      OR (c.janela = v_target_janela OR c.janela = 'dia_todo')
    )
    AND (v_segmento_id IS NULL OR c.segmento_1_id = v_segmento_id OR c.segmento_2_id = v_segmento_id)
    AND (p_exclude_auth_user_id IS NULL OR p.user_id <> p_exclude_auth_user_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.distribuicao_historico dh
      WHERE dh.pipeline_lead_id = p_lead_id
        AND dh.corretor_id = p.user_id
        AND dh.acao = 'timeout'
    )
  ORDER BY
    COALESCE((
      SELECT COUNT(*)
      FROM public.distribuicao_historico dh
      WHERE dh.corretor_id = p.user_id
        AND dh.acao = 'distribuido'
        AND dh.created_at >= v_janela_start
    ), 0) ASC,
    CASE WHEN v_segmento_id IS NOT NULL THEN COALESCE((
      SELECT COUNT(*)
      FROM public.distribuicao_historico dh
      WHERE dh.corretor_id = p.user_id
        AND dh.acao = 'distribuido'
        AND dh.segmento_id = v_segmento_id
        AND dh.created_at >= v_janela_start
    ), 0) ELSE 0 END ASC,
    COALESCE((
      SELECT COUNT(*)
      FROM public.pipeline_leads pl
      WHERE pl.corretor_id = p.user_id
        AND pl.aceite_status IN ('aguardando_aceite', 'aceito')
    ), 0) ASC,
    COALESCE((
      SELECT MAX(dh.created_at)
      FROM public.distribuicao_historico dh
      WHERE dh.corretor_id = p.user_id
        AND dh.acao = 'distribuido'
    ), '2000-01-01'::timestamptz) ASC
  LIMIT 1;

  IF v_chosen_profile_id IS NULL THEN
    UPDATE public.pipeline_leads
    SET aceite_status = 'pendente_distribuicao'
    WHERE id = p_lead_id;

    RETURN jsonb_build_object(
      'success', false,
      'reason', 'no_broker_available',
      'janela', v_target_janela,
      'segmento_id', v_segmento_id
    );
  END IF;

  UPDATE public.pipeline_leads
  SET corretor_id = v_chosen_auth_id,
      aceite_status = 'aguardando_aceite',
      aceite_expira_em = v_expire_at,
      updated_at = v_now
  WHERE id = p_lead_id;

  INSERT INTO public.distribuicao_historico (pipeline_lead_id, corretor_id, acao, segmento_id)
  VALUES (p_lead_id, v_chosen_auth_id, 'distribuido', v_segmento_id);

  INSERT INTO public.roleta_distribuicoes (
    lead_id,
    corretor_id,
    segmento_id,
    janela,
    status,
    enviado_em,
    expira_em
  ) VALUES (
    p_lead_id,
    v_chosen_profile_id,
    v_segmento_id,
    v_target_janela,
    'aguardando',
    v_now,
    v_expire_at
  );

  UPDATE public.roleta_fila
  SET leads_recebidos = COALESCE(leads_recebidos, 0) + 1
  WHERE corretor_id = v_chosen_profile_id
    AND data = v_today_date
    AND ativo = true
    AND (v_segmento_id IS NULL OR segmento_id = v_segmento_id);

  RETURN jsonb_build_object(
    'success', true,
    'corretor_id', v_chosen_auth_id,
    'profile_id', v_chosen_profile_id,
    'segmento_id', v_segmento_id,
    'janela', v_target_janela,
    'lead_nome', v_lead.nome,
    'lead_empreendimento', v_lead.empreendimento,
    'lead_telefone', v_lead.telefone,
    'lead_origem', v_lead.origem
  );
END;
$$;