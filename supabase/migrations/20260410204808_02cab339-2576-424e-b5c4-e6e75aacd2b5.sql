CREATE OR REPLACE FUNCTION public.distribuir_lead_atomico(p_lead_id uuid, p_janela text DEFAULT NULL::text, p_exclude_auth_user_id uuid DEFAULT NULL::uuid, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead RECORD;
  v_segmento_id UUID;
  v_ignora_segmento BOOLEAN := FALSE;
  v_ignora_segmento_camp BOOLEAN := FALSE;
  v_target_janela TEXT;
  v_today_date DATE;
  v_is_sunday BOOLEAN;
  v_is_holiday BOOLEAN := FALSE;
  v_is_special_day BOOLEAN;
  v_chosen_fila_id UUID;
  v_chosen_profile_id UUID;
  v_chosen_auth_id UUID;
  v_now TIMESTAMPTZ := now();
  v_expire_at TIMESTAMPTZ;
  v_emp_lower TEXT;
  v_brt_hour NUMERIC;
  v_brt_minute NUMERIC;
  v_brt_mins NUMERIC;
  v_origens_gerais TEXT[];
  v_lead_origem_lower TEXT;
  v_total_fila INT;
  v_total_blocked INT;
  v_total_eligible INT;
  v_total_blocked_na_roleta INT;
  v_failure_reason TEXT;
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

  IF v_lead.corretor_id IS NOT NULL AND v_lead.aceite_status NOT IN ('pendente_distribuicao', 'timeout') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;

  -- Resolve origens gerais
  SELECT string_to_array(valor, ',') INTO v_origens_gerais
  FROM public.roleta_config WHERE chave = 'origens_gerais';
  IF v_origens_gerais IS NULL THEN
    v_origens_gerais := ARRAY['site', 'site_uhome', 'imovelweb', 'jetimob'];
  END IF;

  v_lead_origem_lower := lower(trim(COALESCE(v_lead.origem, '')));
  v_emp_lower := lower(trim(COALESCE(v_lead.empreendimento, '')));

  -- Resolve segment via roleta_campanhas
  IF v_emp_lower <> '' AND NOT (v_lead_origem_lower = ANY(v_origens_gerais)) THEN
    SELECT segmento_id, COALESCE(ignorar_segmento, false)
    INTO v_segmento_id, v_ignora_segmento_camp
    FROM public.roleta_campanhas
    WHERE ativo = true
      AND (
        lower(trim(empreendimento)) = v_emp_lower
        OR v_emp_lower LIKE '%' || lower(trim(empreendimento)) || '%'
        OR lower(trim(empreendimento)) LIKE '%' || v_emp_lower || '%'
      )
    LIMIT 1;

    IF v_ignora_segmento_camp THEN
      v_segmento_id := NULL;
      v_ignora_segmento := TRUE;
    END IF;
  END IF;

  IF v_lead_origem_lower = ANY(v_origens_gerais) THEN
    v_segmento_id := NULL;
    v_ignora_segmento := TRUE;
  END IF;

  IF v_emp_lower = '' THEN
    v_ignora_segmento := TRUE;
    v_segmento_id := NULL;
  END IF;

  -- Resolve time window
  v_today_date := (v_now AT TIME ZONE 'America/Sao_Paulo')::date;
  v_is_sunday := EXTRACT(DOW FROM (v_now AT TIME ZONE 'America/Sao_Paulo')) = 0;
  SELECT EXISTS(SELECT 1 FROM public.feriados WHERE data = v_today_date) INTO v_is_holiday;
  v_is_special_day := v_is_sunday OR v_is_holiday;

  v_brt_hour := EXTRACT(HOUR FROM (v_now AT TIME ZONE 'America/Sao_Paulo'));
  v_brt_minute := EXTRACT(MINUTE FROM (v_now AT TIME ZONE 'America/Sao_Paulo'));
  v_brt_mins := v_brt_hour * 60 + v_brt_minute;

  IF v_is_special_day THEN
    v_target_janela := 'dia_todo';
  ELSIF p_janela IS NOT NULL AND p_janela <> 'qualquer' THEN
    v_target_janela := p_janela;
  ELSE
    IF v_brt_mins < 720 THEN
      v_target_janela := 'manha';
    ELSIF v_brt_mins < 1110 THEN
      v_target_janela := 'tarde';
    ELSE
      v_target_janela := 'noturna';
    END IF;
  END IF;

  v_expire_at := v_now + interval '10 minutes';

  -- ATTEMPT 1: Normal distribution with DISTINCT ON to deduplicate brokers
  SELECT sub.fila_id, sub.profile_id, sub.auth_id
  INTO v_chosen_fila_id, v_chosen_profile_id, v_chosen_auth_id
  FROM (
    SELECT DISTINCT ON (rf.corretor_id)
      rf.id AS fila_id,
      p.id AS profile_id,
      p.user_id AS auth_id,
      rf.corretor_id,
      rf.ultima_distribuicao_at,
      rc.created_at AS cred_created
    FROM public.roleta_fila rf
    INNER JOIN public.roleta_credenciamentos rc
      ON rc.id = rf.credenciamento_id
    INNER JOIN public.profiles p
      ON p.id = rf.corretor_id
    LEFT JOIN public.corretor_disponibilidade cd
      ON cd.user_id = p.user_id
    WHERE rf.data = v_today_date
      AND rf.ativo = true
      AND rc.status = 'aprovado'
      AND rc.saiu_em IS NULL
      AND rc.data = v_today_date
      AND (p_exclude_auth_user_id IS NULL OR p.user_id <> p_exclude_auth_user_id)
      AND (p_force = true OR (cd.na_roleta IS NOT NULL AND cd.na_roleta = true))
      AND (
        v_segmento_id IS NULL
        OR v_ignora_segmento = true
        OR rf.segmento_id = v_segmento_id
        OR rf.segmento_id IS NULL
      )
      AND (
        v_is_special_day
        OR rf.janela = v_target_janela
        OR rf.janela = 'dia_todo'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.distribuicao_historico dh
        WHERE dh.pipeline_lead_id = p_lead_id
          AND dh.corretor_id = p.user_id
          AND dh.acao IN ('timeout', 'rejeitado')
      )
    ORDER BY rf.corretor_id, rf.ultima_distribuicao_at ASC NULLS FIRST
  ) sub
  ORDER BY sub.ultima_distribuicao_at ASC NULLS FIRST, sub.cred_created ASC
  LIMIT 1;

  -- ATTEMPT 2: Force fallback (CEO dispatch only) with same dedup
  IF v_chosen_auth_id IS NULL AND p_force = true THEN
    SELECT COUNT(DISTINCT rf.corretor_id) INTO v_total_fila
    FROM public.roleta_fila rf
    INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
    WHERE rf.data = v_today_date
      AND rf.ativo = true
      AND rc.status = 'aprovado'
      AND rc.saiu_em IS NULL
      AND rc.data = v_today_date
      AND (
        v_segmento_id IS NULL OR v_ignora_segmento = true
        OR rf.segmento_id = v_segmento_id OR rf.segmento_id IS NULL
      )
      AND (v_is_special_day OR rf.janela = v_target_janela OR rf.janela = 'dia_todo');

    SELECT COUNT(DISTINCT rf.corretor_id) INTO v_total_blocked
    FROM public.roleta_fila rf
    INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
    INNER JOIN public.profiles p ON p.id = rf.corretor_id
    WHERE rf.data = v_today_date
      AND rf.ativo = true
      AND rc.status = 'aprovado'
      AND rc.saiu_em IS NULL
      AND rc.data = v_today_date
      AND (
        v_segmento_id IS NULL OR v_ignora_segmento = true
        OR rf.segmento_id = v_segmento_id OR rf.segmento_id IS NULL
      )
      AND (v_is_special_day OR rf.janela = v_target_janela OR rf.janela = 'dia_todo')
      AND EXISTS (
        SELECT 1 FROM public.distribuicao_historico dh
        WHERE dh.pipeline_lead_id = p_lead_id
          AND dh.corretor_id = p.user_id
          AND dh.acao IN ('timeout', 'rejeitado')
      );

    IF v_total_fila > 0 AND v_total_blocked >= v_total_fila THEN
      SELECT sub.fila_id, sub.profile_id, sub.auth_id
      INTO v_chosen_fila_id, v_chosen_profile_id, v_chosen_auth_id
      FROM (
        SELECT DISTINCT ON (rf.corretor_id)
          rf.id AS fila_id,
          p.id AS profile_id,
          p.user_id AS auth_id,
          rf.corretor_id,
          rf.ultima_distribuicao_at,
          rc.created_at AS cred_created
        FROM public.roleta_fila rf
        INNER JOIN public.roleta_credenciamentos rc
          ON rc.id = rf.credenciamento_id
        INNER JOIN public.profiles p
          ON p.id = rf.corretor_id
        WHERE rf.data = v_today_date
          AND rf.ativo = true
          AND rc.status = 'aprovado'
          AND rc.saiu_em IS NULL
          AND rc.data = v_today_date
          AND (p_exclude_auth_user_id IS NULL OR p.user_id <> p_exclude_auth_user_id)
          AND (
            v_segmento_id IS NULL
            OR v_ignora_segmento = true
            OR rf.segmento_id = v_segmento_id
            OR rf.segmento_id IS NULL
          )
          AND (
            v_is_special_day
            OR rf.janela = v_target_janela
            OR rf.janela = 'dia_todo'
          )
        ORDER BY rf.corretor_id, rf.ultima_distribuicao_at ASC NULLS FIRST
      ) sub
      ORDER BY sub.ultima_distribuicao_at ASC NULLS FIRST, sub.cred_created ASC
      LIMIT 1;

      IF v_chosen_auth_id IS NOT NULL THEN
        INSERT INTO public.distribuicao_historico (pipeline_lead_id, corretor_id, acao, segmento_id)
        VALUES (p_lead_id, v_chosen_auth_id, 'force_recovered', v_segmento_id);
      END IF;
    END IF;
  END IF;

  -- If still no broker, return detailed reason
  IF v_chosen_auth_id IS NULL THEN
    UPDATE public.pipeline_leads
    SET aceite_status = 'pendente_distribuicao',
        corretor_id = NULL
    WHERE id = p_lead_id;

    IF v_total_fila IS NULL THEN
      SELECT COUNT(DISTINCT rf.corretor_id) INTO v_total_fila
      FROM public.roleta_fila rf
      INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
      WHERE rf.data = v_today_date
        AND rf.ativo = true
        AND rc.status = 'aprovado'
        AND rc.saiu_em IS NULL
        AND rc.data = v_today_date
        AND (v_is_special_day OR rf.janela = v_target_janela OR rf.janela = 'dia_todo');
    END IF;

    -- Count brokers blocked specifically by na_roleta = false
    SELECT COUNT(DISTINCT rf.corretor_id) INTO v_total_blocked_na_roleta
    FROM public.roleta_fila rf
    INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
    INNER JOIN public.profiles p ON p.id = rf.corretor_id
    LEFT JOIN public.corretor_disponibilidade cd ON cd.user_id = p.user_id
    WHERE rf.data = v_today_date
      AND rf.ativo = true
      AND rc.status = 'aprovado'
      AND rc.saiu_em IS NULL
      AND rc.data = v_today_date
      AND (v_is_special_day OR rf.janela = v_target_janela OR rf.janela = 'dia_todo')
      AND (cd.na_roleta IS NULL OR cd.na_roleta = false);

    -- Count eligible brokers (in fila, na_roleta=true, not blocked by history)
    SELECT COUNT(DISTINCT rf.corretor_id) INTO v_total_eligible
    FROM public.roleta_fila rf
    INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
    INNER JOIN public.profiles p ON p.id = rf.corretor_id
    LEFT JOIN public.corretor_disponibilidade cd ON cd.user_id = p.user_id
    WHERE rf.data = v_today_date
      AND rf.ativo = true
      AND rc.status = 'aprovado'
      AND rc.saiu_em IS NULL
      AND rc.data = v_today_date
      AND (cd.na_roleta IS NOT NULL AND cd.na_roleta = true)
      AND (
        v_segmento_id IS NULL OR v_ignora_segmento = true
        OR rf.segmento_id = v_segmento_id OR rf.segmento_id IS NULL
      )
      AND (v_is_special_day OR rf.janela = v_target_janela OR rf.janela = 'dia_todo')
      AND NOT EXISTS (
        SELECT 1 FROM public.distribuicao_historico dh
        WHERE dh.pipeline_lead_id = p_lead_id
          AND dh.corretor_id = p.user_id
          AND dh.acao IN ('timeout', 'rejeitado')
      );

    IF v_total_fila = 0 THEN
      v_failure_reason := 'no_fila_active';
    ELSE
      IF v_total_blocked IS NULL THEN
        SELECT COUNT(DISTINCT rf.corretor_id) INTO v_total_blocked
        FROM public.roleta_fila rf
        INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
        INNER JOIN public.profiles p ON p.id = rf.corretor_id
        WHERE rf.data = v_today_date
          AND rf.ativo = true
          AND rc.status = 'aprovado'
          AND rc.saiu_em IS NULL
          AND rc.data = v_today_date
          AND (
            v_segmento_id IS NULL OR v_ignora_segmento = true
            OR rf.segmento_id = v_segmento_id OR rf.segmento_id IS NULL
          )
          AND (v_is_special_day OR rf.janela = v_target_janela OR rf.janela = 'dia_todo')
          AND EXISTS (
            SELECT 1 FROM public.distribuicao_historico dh
            WHERE dh.pipeline_lead_id = p_lead_id
              AND dh.corretor_id = p.user_id
              AND dh.acao IN ('timeout', 'rejeitado')
          );
      END IF;

      IF v_total_blocked >= v_total_fila THEN
        v_failure_reason := 'all_brokers_exhausted';
      ELSIF COALESCE(v_total_blocked_na_roleta, 0) > 0 AND COALESCE(v_total_eligible, 0) = 0 THEN
        v_failure_reason := 'all_blocked_na_roleta';
      ELSE
        v_failure_reason := 'no_broker_available';
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'reason', v_failure_reason,
      'detail', jsonb_build_object(
        'total_fila', COALESCE(v_total_fila, 0),
        'total_blocked', COALESCE(v_total_blocked, 0),
        'total_eligible', COALESCE(v_total_eligible, 0),
        'total_blocked_na_roleta', COALESCE(v_total_blocked_na_roleta, 0),
        'segmento_id', v_segmento_id,
        'ignora_segmento', v_ignora_segmento,
        'janela', v_target_janela
      )
    );
  END IF;

  -- Assign lead
  UPDATE public.pipeline_leads
  SET corretor_id = v_chosen_auth_id,
      aceite_status = 'aguardando_aceite',
      distribuido_em = v_now,
      aceite_expira_em = v_expire_at,
      roleta_distribuido_em = v_now
  WHERE id = p_lead_id;

  INSERT INTO public.distribuicao_historico (pipeline_lead_id, corretor_id, acao, segmento_id)
  SELECT p_lead_id, v_chosen_auth_id, 'distribuido', v_segmento_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.distribuicao_historico
    WHERE pipeline_lead_id = p_lead_id AND corretor_id = v_chosen_auth_id AND acao = 'force_recovered'
      AND created_at > v_now - interval '1 second'
  );

  INSERT INTO public.roleta_distribuicoes (lead_id, corretor_id, segmento_id, janela)
  VALUES (p_lead_id, v_chosen_profile_id, v_segmento_id, v_target_janela)
  ON CONFLICT DO NOTHING;

  -- Update chosen row
  UPDATE public.roleta_fila
  SET leads_recebidos = leads_recebidos + 1,
      ultima_distribuicao_at = v_now
  WHERE id = v_chosen_fila_id;

  -- Sync timestamp across ALL rows of same broker on same day
  UPDATE public.roleta_fila
  SET ultima_distribuicao_at = v_now
  WHERE data = v_today_date
    AND corretor_id = v_chosen_profile_id
    AND id <> v_chosen_fila_id;

  RETURN jsonb_build_object(
    'success', true,
    'corretor_id', v_chosen_auth_id,
    'profile_id', v_chosen_profile_id,
    'segmento_id', v_segmento_id,
    'janela', v_target_janela,
    'lead_nome', v_lead.nome,
    'lead_empreendimento', v_lead.empreendimento,
    'lead_telefone', v_lead.telefone,
    'lead_origem', v_lead.origem,
    'expire_at', v_expire_at
  );
END;
$function$;