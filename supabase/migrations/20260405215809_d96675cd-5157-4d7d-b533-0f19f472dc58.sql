
-- Add ultima_distribuicao_at to roleta_fila for pure round-robin pointer
ALTER TABLE public.roleta_fila 
ADD COLUMN IF NOT EXISTS ultima_distribuicao_at TIMESTAMPTZ DEFAULT NULL;

-- Recreate the RPC with pure round-robin logic
CREATE OR REPLACE FUNCTION public.distribuir_lead_atomico(
  p_lead_id UUID,
  p_janela TEXT DEFAULT NULL,
  p_exclude_auth_user_id UUID DEFAULT NULL,
  p_force BOOLEAN DEFAULT FALSE
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

  SELECT string_to_array(valor, ',') INTO v_origens_gerais
  FROM public.roleta_config WHERE chave = 'origens_gerais';
  IF v_origens_gerais IS NULL THEN
    v_origens_gerais := ARRAY['site', 'site_uhome', 'imovelweb', 'jetimob'];
  END IF;

  v_lead_origem_lower := lower(trim(COALESCE(v_lead.origem, '')));

  IF v_lead_origem_lower = ANY(v_origens_gerais) THEN
    v_ignora_segmento := TRUE;
  END IF;

  v_emp_lower := lower(trim(COALESCE(v_lead.empreendimento, '')));
  IF v_emp_lower <> '' AND NOT v_ignora_segmento THEN
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

  IF v_lead_origem_lower = ANY(v_origens_gerais) THEN
    v_segmento_id := NULL;
    v_ignora_segmento := TRUE;
  END IF;

  IF v_emp_lower = '' THEN
    v_ignora_segmento := TRUE;
    v_segmento_id := NULL;
  END IF;

  v_today_date := (v_now AT TIME ZONE 'America/Sao_Paulo')::date;
  v_today_start := (date_trunc('day', v_now AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo';
  v_is_sunday := EXTRACT(DOW FROM (v_now AT TIME ZONE 'America/Sao_Paulo')) = 0;

  SELECT EXISTS(
    SELECT 1 FROM public.feriados WHERE data = v_today_date
  ) INTO v_is_holiday;

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

  -- PURE ROUND-ROBIN: pick broker who received LEAST RECENTLY (or never)
  SELECT rf.id, p.id, p.user_id
  INTO v_chosen_fila_id, v_chosen_profile_id, v_chosen_auth_id
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
  ORDER BY
    rf.ultima_distribuicao_at ASC NULLS FIRST,
    rc.created_at ASC
  LIMIT 1;

  IF v_chosen_auth_id IS NULL THEN
    UPDATE public.pipeline_leads
    SET aceite_status = 'pendente_distribuicao',
        corretor_id = NULL
    WHERE id = p_lead_id;

    RETURN jsonb_build_object('success', false, 'reason', 'no_broker_available');
  END IF;

  UPDATE public.pipeline_leads
  SET corretor_id = v_chosen_auth_id,
      aceite_status = 'aguardando_aceite',
      distribuido_em = v_now,
      aceite_expira_em = v_expire_at,
      roleta_distribuido_em = v_now
  WHERE id = p_lead_id;

  INSERT INTO public.distribuicao_historico (pipeline_lead_id, corretor_id, acao, segmento_id)
  VALUES (p_lead_id, v_chosen_auth_id, 'distribuido', v_segmento_id);

  INSERT INTO public.roleta_distribuicoes (lead_id, corretor_id, segmento_id, janela)
  VALUES (p_lead_id, v_chosen_profile_id, v_segmento_id, v_target_janela)
  ON CONFLICT DO NOTHING;

  -- Update round-robin pointer
  UPDATE public.roleta_fila
  SET leads_recebidos = leads_recebidos + 1,
      ultima_distribuicao_at = v_now
  WHERE id = v_chosen_fila_id;

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
$$;
