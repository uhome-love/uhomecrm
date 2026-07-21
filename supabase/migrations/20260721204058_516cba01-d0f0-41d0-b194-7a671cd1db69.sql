
-- ── 1. Nova RPC: credenciar_por_alocacao ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.credenciar_por_alocacao(p_janela text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_pode boolean;
  v_alocacao uuid[];
  v_segmentos uuid[];
  v_seg1 uuid;
  v_seg2 uuid;
  v_cred_id uuid;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_max_pos int;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id INTO v_profile_id FROM profiles WHERE user_id = v_auth_user_id;
  IF v_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profile não encontrado');
  END IF;

  -- Elegibilidade padrão
  v_pode := corretor_pode_entrar_roleta(v_auth_user_id);
  IF NOT v_pode THEN
    RETURN json_build_object('success', false, 'error',
      'Você possui mais de 10 leads desatualizados. Atualize seu pipeline antes de entrar na roleta.');
  END IF;

  -- Lê alocação do corretor
  SELECT empreendimentos INTO v_alocacao
  FROM corretor_alocacao WHERE user_id = v_auth_user_id;

  IF v_alocacao IS NULL OR array_length(v_alocacao, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Você ainda não tem empreendimentos alocados. Fale com seu gestor.');
  END IF;

  -- Deriva segmentos únicos a partir dos empreendimentos alocados (apenas ativos)
  SELECT array_agg(DISTINCT ec.segmento_id ORDER BY ec.segmento_id)
    INTO v_segmentos
  FROM empreendimentos_canonicos ec
  WHERE ec.id = ANY(v_alocacao)
    AND ec.segmento_id IS NOT NULL;

  IF v_segmentos IS NULL OR array_length(v_segmentos, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Nenhum segmento identificado nos empreendimentos alocados. Fale com seu gestor.');
  END IF;

  v_seg1 := v_segmentos[1];
  IF array_length(v_segmentos, 1) >= 2 THEN v_seg2 := v_segmentos[2]; END IF;

  -- Upsert credenciamento com auto-aprovação
  INSERT INTO roleta_credenciamentos (
    corretor_id, auth_user_id, data, janela,
    segmento_1_id, segmento_2_id, status
  ) VALUES (
    v_profile_id, v_auth_user_id, v_hoje, p_janela,
    v_seg1, v_seg2, 'aprovado'
  )
  ON CONFLICT (corretor_id, data, janela)
  DO UPDATE SET
    segmento_1_id = EXCLUDED.segmento_1_id,
    segmento_2_id = EXCLUDED.segmento_2_id,
    status = 'aprovado',
    saiu_em = NULL
  RETURNING id INTO v_cred_id;

  -- Fila (posição incremental)
  SELECT COALESCE(MAX(posicao), 0) INTO v_max_pos
  FROM roleta_fila WHERE data = v_hoje AND janela = p_janela AND ativo = true;

  INSERT INTO roleta_fila (credenciamento_id, corretor_id, segmento_id, data, janela, posicao, ativo)
  VALUES (v_cred_id, v_profile_id, v_seg1, v_hoje, p_janela, v_max_pos + 1, true)
  ON CONFLICT DO NOTHING;

  IF v_seg2 IS NOT NULL THEN
    INSERT INTO roleta_fila (credenciamento_id, corretor_id, segmento_id, data, janela, posicao, ativo)
    VALUES (v_cred_id, v_profile_id, v_seg2, v_hoje, p_janela, v_max_pos + 2, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Disponibilidade
  INSERT INTO corretor_disponibilidade (user_id, na_roleta, status, updated_at)
  VALUES (v_auth_user_id, true, 'online', now())
  ON CONFLICT (user_id) DO UPDATE SET na_roleta = true, updated_at = now();

  RETURN json_build_object(
    'success', true,
    'credenciamento_id', v_cred_id,
    'segmentos_derivados', v_segmentos,
    'empreendimentos', v_alocacao,
    'message', 'Presença registrada na roleta.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.credenciar_por_alocacao(text) TO authenticated;

-- ── 2. Distribuição filtrada por alocação (com fallback) ─────────────────────
CREATE OR REPLACE FUNCTION public.distribuir_lead_atomico(
  p_lead_id uuid,
  p_janela text DEFAULT NULL::text,
  p_exclude_auth_user_id uuid DEFAULT NULL::uuid,
  p_force boolean DEFAULT false
)
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
  v_avulso_segmento_id UUID := '9948f523-29f4-46a7-bc1b-81ff8bb8dd50';
  v_lead_origem_lower TEXT;
  v_total_fila INT;
  v_failure_reason TEXT;
  v_matched_campaign BOOLEAN := FALSE;
  v_emp_canonico_id UUID;
  v_alocacao_match_count INT := 0;
  v_used_alocacao_filter BOOLEAN := FALSE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('distribuir_lead_atomico'));

  SELECT id, nome, telefone, empreendimento, aceite_status, corretor_id, origem, empreendimento_canonico_id
    INTO v_lead
  FROM public.pipeline_leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF v_lead IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF v_lead.corretor_id IS NOT NULL AND v_lead.aceite_status NOT IN ('pendente_distribuicao','timeout','aguardando_aceite','pendente','pendente_aceite') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;
  IF v_lead.corretor_id IS NOT NULL AND v_lead.aceite_status IN ('aceito') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;

  v_emp_canonico_id := v_lead.empreendimento_canonico_id;

  SELECT string_to_array(valor, ',') INTO v_origens_gerais
  FROM public.roleta_config WHERE chave = 'origens_gerais';
  IF v_origens_gerais IS NULL THEN v_origens_gerais := ARRAY['jetimob']; END IF;

  v_lead_origem_lower := lower(trim(COALESCE(v_lead.origem,'')));
  v_emp_lower := lower(trim(COALESCE(v_lead.empreendimento,'')));

  IF v_lead_origem_lower LIKE '%imovelweb%'
     OR v_lead_origem_lower LIKE '%imovel web%'
     OR v_lead_origem_lower LIKE '%site%' THEN
    v_segmento_id := v_avulso_segmento_id;
    v_ignora_segmento := FALSE;
    v_matched_campaign := TRUE;
  END IF;

  IF NOT v_matched_campaign AND v_emp_lower <> '' THEN
    SELECT segmento_id, COALESCE(ignorar_segmento,false)
      INTO v_segmento_id, v_ignora_segmento_camp
    FROM public.roleta_campanhas
    WHERE ativo = true
      AND (
        lower(trim(empreendimento)) = v_emp_lower
        OR v_emp_lower LIKE '%'||lower(trim(empreendimento))||'%'
        OR lower(trim(empreendimento)) LIKE '%'||v_emp_lower||'%'
      )
    ORDER BY (lower(trim(empreendimento)) = v_emp_lower) DESC, length(empreendimento) DESC
    LIMIT 1;

    IF v_segmento_id IS NOT NULL OR v_ignora_segmento_camp THEN
      v_matched_campaign := TRUE;
    END IF;

    IF v_ignora_segmento_camp THEN
      v_segmento_id := NULL;
      v_ignora_segmento := TRUE;
    END IF;
  END IF;

  IF NOT v_matched_campaign AND v_lead_origem_lower = ANY(v_origens_gerais) THEN
    v_segmento_id := NULL;
    v_ignora_segmento := TRUE;
  ELSIF NOT v_matched_campaign THEN
    v_segmento_id := v_avulso_segmento_id;
    v_ignora_segmento := FALSE;
  END IF;

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
    IF v_brt_mins < 720 THEN v_target_janela := 'manha';
    ELSIF v_brt_mins < 1110 THEN v_target_janela := 'tarde';
    ELSE v_target_janela := 'noturna'; END IF;
  END IF;

  v_expire_at := v_now + interval '10 minutes';

  -- Pré-check: quantos corretores elegíveis têm o empreendimento canônico do lead na alocação?
  IF v_emp_canonico_id IS NOT NULL THEN
    SELECT count(*)
      INTO v_alocacao_match_count
    FROM public.roleta_fila rf
    INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
    INNER JOIN public.profiles p ON p.id = rf.corretor_id
    INNER JOIN public.corretor_alocacao ca ON ca.user_id = p.user_id
    LEFT JOIN public.corretor_disponibilidade cd ON cd.user_id = p.user_id
    WHERE rc.status = 'aprovado'
      AND rc.data = v_today_date
      AND (rc.janela = v_target_janela OR rc.janela = 'dia_todo' OR v_target_janela = 'dia_todo')
      AND (v_ignora_segmento OR rc.segmento_1_id = v_segmento_id OR rc.segmento_2_id = v_segmento_id)
      AND (p_exclude_auth_user_id IS NULL OR p.user_id <> p_exclude_auth_user_id)
      AND COALESCE(cd.na_roleta, true) = true
      AND COALESCE(rf.ativo, true) = true
      AND v_emp_canonico_id = ANY(ca.empreendimentos);

    IF v_alocacao_match_count > 0 THEN
      v_used_alocacao_filter := TRUE;
    END IF;
  END IF;

  WITH elegiveis AS (
    SELECT
      rf.id AS fila_id,
      p.id AS profile_id,
      p.user_id AS auth_id,
      rf.corretor_id,
      rf.ultima_distribuicao_at,
      COALESCE(rf.leads_recebidos,0) AS leads_recebidos,
      (
        SELECT count(*)
        FROM public.roleta_distribuicoes rd
        WHERE rd.corretor_id = p.id
          AND rd.janela = v_target_janela
          AND rd.enviado_em >= (v_today_date::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND rd.enviado_em <  ((v_today_date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND (v_ignora_segmento OR rd.segmento_id = v_segmento_id OR rd.segmento_id IS NULL)
      ) AS recebidos_no_turno
    FROM public.roleta_fila rf
    INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
    INNER JOIN public.profiles p ON p.id = rf.corretor_id
    LEFT JOIN public.corretor_disponibilidade cd ON cd.user_id = p.user_id
    LEFT JOIN public.corretor_alocacao ca ON ca.user_id = p.user_id
    WHERE rc.status = 'aprovado'
      AND rc.data = v_today_date
      AND (rc.janela = v_target_janela OR rc.janela = 'dia_todo' OR v_target_janela = 'dia_todo')
      AND (v_ignora_segmento OR rc.segmento_1_id = v_segmento_id OR rc.segmento_2_id = v_segmento_id)
      AND (p_exclude_auth_user_id IS NULL OR p.user_id <> p_exclude_auth_user_id)
      AND COALESCE(cd.na_roleta, true) = true
      AND COALESCE(rf.ativo, true) = true
      AND (
        NOT v_used_alocacao_filter
        OR (ca.empreendimentos IS NOT NULL AND v_emp_canonico_id = ANY(ca.empreendimentos))
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.distribuicao_historico dh
        WHERE dh.pipeline_lead_id = p_lead_id
          AND dh.corretor_id = p.user_id
          AND dh.acao = 'rejeitado'
          AND lower(COALESCE(dh.motivo_rejeicao, '')) = 'cliente_repetido'
      )
  ), filtrados AS (
    SELECT *
    FROM elegiveis
    WHERE p_force = true
       OR recebidos_no_turno = (SELECT MIN(recebidos_no_turno) FROM elegiveis)
  )
  SELECT sub.fila_id, sub.profile_id, sub.auth_id
    INTO v_chosen_fila_id, v_chosen_profile_id, v_chosen_auth_id
  FROM (
    SELECT DISTINCT ON (corretor_id)
      fila_id, profile_id, auth_id, corretor_id,
      ultima_distribuicao_at, leads_recebidos, recebidos_no_turno
    FROM filtrados
    ORDER BY corretor_id, ultima_distribuicao_at NULLS FIRST, leads_recebidos ASC, fila_id ASC
  ) sub
  ORDER BY sub.recebidos_no_turno ASC, sub.ultima_distribuicao_at NULLS FIRST, sub.leads_recebidos ASC, sub.fila_id ASC
  LIMIT 1;

  IF v_chosen_fila_id IS NULL THEN
    SELECT count(*) INTO v_total_fila
    FROM public.roleta_fila rf
    INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
    WHERE rc.status = 'aprovado' AND rc.data = v_today_date;

    IF v_total_fila = 0 THEN v_failure_reason := 'no_fila_active';
    ELSE v_failure_reason := 'no_broker_available'; END IF;

    RETURN jsonb_build_object(
      'success', false, 'reason', v_failure_reason,
      'segmento_id', v_segmento_id, 'janela', v_target_janela,
      'total_fila_today', v_total_fila,
      'usou_filtro_alocacao', v_used_alocacao_filter
    );
  END IF;

  UPDATE public.pipeline_leads
  SET corretor_id = v_chosen_auth_id,
      aceite_status = 'aguardando_aceite',
      aceite_expira_em = v_expire_at,
      distribuido_em = v_now,
      updated_at = v_now
  WHERE id = p_lead_id
    AND (
      corretor_id IS NULL
      OR aceite_status IN ('pendente_distribuicao','timeout','aguardando_aceite','pendente','pendente_aceite')
    );

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;

  UPDATE public.roleta_fila
  SET ultima_distribuicao_at = v_now,
      leads_recebidos = COALESCE(leads_recebidos, 0) + 1
  WHERE id = v_chosen_fila_id;

  INSERT INTO public.roleta_distribuicoes (lead_id, corretor_id, segmento_id, janela, enviado_em, expira_em, status)
  VALUES (p_lead_id, v_chosen_profile_id, v_segmento_id, v_target_janela, v_now, v_expire_at, 'aguardando');

  INSERT INTO public.distribuicao_historico (pipeline_lead_id, corretor_id, segmento_id, acao, created_at)
  VALUES (p_lead_id, v_chosen_auth_id, v_segmento_id, 'distribuido', v_now);

  RETURN jsonb_build_object(
    'success', true,
    'corretor_id', v_chosen_auth_id,
    'profile_id', v_chosen_profile_id,
    'segmento_id', v_segmento_id,
    'janela', v_target_janela,
    'expira_em', v_expire_at,
    'usou_filtro_alocacao', v_used_alocacao_filter
  );
END;
$function$;
