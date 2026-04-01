
-- Drop the old ineffective lock function
DROP FUNCTION IF EXISTS public.distribute_lead_with_lock(uuid, text);

-- Create the atomic distribution RPC
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
  v_is_sunday BOOLEAN;
  v_chosen_profile_id UUID;
  v_chosen_auth_id UUID;
  v_now TIMESTAMPTZ := now();
  v_expire_at TIMESTAMPTZ;
  v_emp_lower TEXT;
  v_camp RECORD;
BEGIN
  -- 1. Acquire advisory lock (released at COMMIT)
  PERFORM pg_advisory_xact_lock(hashtext('distribuir_lead_atomico'));

  -- 2. Get the lead (with FOR UPDATE to lock the row)
  SELECT id, nome, telefone, empreendimento, aceite_status, corretor_id, origem
  INTO v_lead
  FROM pipeline_leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF v_lead IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF v_lead.corretor_id IS NOT NULL AND v_lead.aceite_status != 'pendente_distribuicao' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;

  -- 3. Resolve segment from empreendimento via roleta_campanhas
  v_emp_lower := lower(trim(COALESCE(v_lead.empreendimento, '')));
  IF v_emp_lower != '' THEN
    SELECT segmento_id, COALESCE(ignorar_segmento, false)
    INTO v_segmento_id, v_ignora_segmento
    FROM roleta_campanhas
    WHERE ativo = true
      AND (lower(trim(empreendimento)) = v_emp_lower 
           OR v_emp_lower LIKE '%' || lower(trim(empreendimento)) || '%'
           OR lower(trim(empreendimento)) LIKE '%' || v_emp_lower || '%')
    LIMIT 1;

    IF v_ignora_segmento THEN
      v_segmento_id := NULL;
    END IF;
  END IF;

  -- 4. Calculate today in BRT
  v_today_date := (v_now AT TIME ZONE 'America/Sao_Paulo')::date;
  v_today_start := v_today_date::timestamptz AT TIME ZONE 'America/Sao_Paulo';
  v_is_sunday := (EXTRACT(DOW FROM v_today_date) = 0);

  -- Determine janela
  IF p_janela IS NOT NULL THEN
    v_target_janela := p_janela;
  ELSIF v_is_sunday THEN
    v_target_janela := 'dia_todo';
  ELSE
    DECLARE v_hour INT := EXTRACT(HOUR FROM v_now AT TIME ZONE 'America/Sao_Paulo');
    BEGIN
      IF v_hour >= 8 AND v_hour < 13 THEN v_target_janela := 'manha';
      ELSIF v_hour >= 13 AND v_hour < 19 THEN v_target_janela := 'tarde';
      ELSE v_target_janela := 'noturna';
      END IF;
    END;
  END IF;

  -- 5. Find the best corretor
  v_expire_at := v_now + interval '10 minutes';

  SELECT 
    c.corretor_id AS profile_id,
    p.user_id AS auth_id
  INTO v_chosen_profile_id, v_chosen_auth_id
  FROM roleta_credenciamentos c
  JOIN profiles p ON p.id = c.corretor_id
  WHERE c.data = v_today_date
    AND c.status = 'aprovado'
    AND c.saiu_em IS NULL
    AND (v_target_janela = 'dia_todo' OR c.janela = v_target_janela)
    AND p.user_id IS NOT NULL
    -- Segment filter: if lead has segment, corretor must have it
    AND (v_segmento_id IS NULL OR c.segmento_1_id = v_segmento_id OR c.segmento_2_id = v_segmento_id)
    -- Exclude specific auth user (e.g. who just rejected)
    AND (p_exclude_auth_user_id IS NULL OR p.user_id != p_exclude_auth_user_id)
    -- Exclude corretores who already timed out on this lead
    AND NOT EXISTS (
      SELECT 1 FROM distribuicao_historico dh
      WHERE dh.pipeline_lead_id = p_lead_id
        AND dh.corretor_id = p.user_id
        AND dh.acao = 'timeout'
    )
  ORDER BY
    -- 1st: fewest leads globally today
    COALESCE((
      SELECT COUNT(*) FROM distribuicao_historico dh
      WHERE dh.corretor_id = p.user_id
        AND dh.acao = 'distribuido'
        AND dh.created_at >= v_today_start
    ), 0) ASC,
    -- 2nd: fewest leads in this segment today (tie-breaker)
    CASE WHEN v_segmento_id IS NOT NULL THEN
      COALESCE((
        SELECT COUNT(*) FROM distribuicao_historico dh
        WHERE dh.corretor_id = p.user_id
          AND dh.acao = 'distribuido'
          AND dh.segmento_id = v_segmento_id
          AND dh.created_at >= v_today_start
      ), 0)
    ELSE 0 END ASC,
    -- 3rd: fewest active leads in pipeline
    COALESCE((
      SELECT COUNT(*) FROM pipeline_leads pl
      WHERE pl.corretor_id = p.user_id
        AND pl.aceite_status IN ('aceito', 'pendente')
    ), 0) ASC,
    -- 4th: who received a lead longest ago
    COALESCE((
      SELECT MAX(dh.created_at) FROM distribuicao_historico dh
      WHERE dh.corretor_id = p.user_id
        AND dh.acao = 'distribuido'
        AND dh.created_at >= v_today_start
    ), '1970-01-01'::timestamptz) ASC
  LIMIT 1;

  IF v_chosen_auth_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'reason', 'no_corretor_available',
      'segmento_id', v_segmento_id
    );
  END IF;

  -- 6. Assign the lead atomically
  UPDATE pipeline_leads
  SET corretor_id = v_chosen_auth_id,
      aceite_status = 'pendente',
      distribuido_em = v_now,
      aceite_expira_em = v_expire_at,
      updated_at = v_now
  WHERE id = p_lead_id;

  -- 7. Record in distribuicao_historico
  INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, segmento_id, acao)
  VALUES (p_lead_id, v_chosen_auth_id, v_segmento_id, 'distribuido');

  -- 8. Record in roleta_distribuicoes
  INSERT INTO roleta_distribuicoes (lead_id, corretor_id, segmento_id, janela, status, enviado_em, expira_em, avisos_enviados)
  VALUES (p_lead_id, v_chosen_profile_id, v_segmento_id, v_target_janela, 'aguardando', v_now, v_expire_at, 0);

  -- 9. Increment roleta_fila if segment exists
  IF v_segmento_id IS NOT NULL THEN
    PERFORM increment_roleta_fila(v_chosen_profile_id, v_segmento_id, v_today_date);
  END IF;

  -- 10. Return result
  RETURN jsonb_build_object(
    'success', true,
    'corretor_id', v_chosen_auth_id,
    'corretor_profile_id', v_chosen_profile_id,
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
