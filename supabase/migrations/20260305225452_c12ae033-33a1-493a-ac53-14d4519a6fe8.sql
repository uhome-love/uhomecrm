
-- 1. Add idempotency_key to tentativas for dedup
ALTER TABLE public.oferta_ativa_tentativas ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;

-- 2. Server-side function: fetch next lead for corretor (anti-repeat, scoring, lock in one atomic call)
CREATE OR REPLACE FUNCTION public.fetch_next_lead(
  p_corretor_id uuid,
  p_lista_id uuid,
  p_lock_minutes integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead oferta_ativa_leads%ROWTYPE;
  v_now timestamptz := now();
  v_today_start timestamptz := date_trunc('day', v_now);
  v_lock_until timestamptz := v_now + (p_lock_minutes || ' minutes')::interval;
BEGIN
  -- Clean expired locks first
  UPDATE oferta_ativa_leads
  SET em_atendimento_por = NULL, em_atendimento_ate = NULL
  WHERE em_atendimento_ate < v_now AND em_atendimento_por IS NOT NULL;

  -- Select best eligible lead with composite scoring:
  -- 1. Not already worked by this corretor today
  -- 2. Not locked by another
  -- 3. Cooldown expired
  -- 4. Score: least attempts + oldest without contact + randomness
  SELECT l.* INTO v_lead
  FROM oferta_ativa_leads l
  WHERE l.lista_id = p_lista_id
    AND l.status IN ('na_fila', 'em_cooldown')
    AND (l.proxima_tentativa_apos IS NULL OR l.proxima_tentativa_apos <= v_now)
    AND (l.em_atendimento_por IS NULL OR l.em_atendimento_por = p_corretor_id OR l.em_atendimento_ate < v_now)
    -- Anti-repeat: not attempted by this corretor today
    AND NOT EXISTS (
      SELECT 1 FROM oferta_ativa_tentativas t
      WHERE t.lead_id = l.id
        AND t.corretor_id = p_corretor_id
        AND t.created_at >= v_today_start
    )
  ORDER BY
    l.tentativas_count ASC,
    EXTRACT(EPOCH FROM (v_now - COALESCE(l.ultima_tentativa, l.created_at))) DESC,
    random()
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    -- Try without anti-repeat constraint (all leads attempted today)
    SELECT l.* INTO v_lead
    FROM oferta_ativa_leads l
    WHERE l.lista_id = p_lista_id
      AND l.status IN ('na_fila', 'em_cooldown')
      AND (l.proxima_tentativa_apos IS NULL OR l.proxima_tentativa_apos <= v_now)
      AND (l.em_atendimento_por IS NULL OR l.em_atendimento_por = p_corretor_id OR l.em_atendimento_ate < v_now)
    ORDER BY l.tentativas_count ASC, random()
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('found', false, 'reason', 'no_leads_available');
    END IF;
  END IF;

  -- Lock the lead atomically
  UPDATE oferta_ativa_leads
  SET em_atendimento_por = p_corretor_id,
      em_atendimento_ate = v_lock_until
  WHERE id = v_lead.id;

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
$$;

-- 3. Server-side function: renew lock (heartbeat)
CREATE OR REPLACE FUNCTION public.renew_lead_lock(
  p_lead_id uuid,
  p_corretor_id uuid,
  p_lock_minutes integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_expiry timestamptz := now() + (p_lock_minutes || ' minutes')::interval;
BEGIN
  UPDATE oferta_ativa_leads
  SET em_atendimento_ate = v_new_expiry
  WHERE id = p_lead_id
    AND em_atendimento_por = p_corretor_id;

  IF FOUND THEN
    RETURN jsonb_build_object('renewed', true, 'expires_at', v_new_expiry);
  ELSE
    RETURN jsonb_build_object('renewed', false, 'reason', 'not_locked_by_you');
  END IF;
END;
$$;

-- 4. Server-side function: finalize attempt with idempotency + progressive cooldown
CREATE OR REPLACE FUNCTION public.finalizar_tentativa_v2(
  p_lead_id uuid,
  p_corretor_id uuid,
  p_canal text,
  p_resultado text,
  p_feedback text,
  p_lista_id uuid DEFAULT NULL,
  p_empreendimento text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_visita_marcada boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead oferta_ativa_leads%ROWTYPE;
  v_lista oferta_ativa_listas%ROWTYPE;
  v_existing_attempt uuid;
  v_pontos integer := 1;
  v_cooldown_intervals integer[] := ARRAY[15, 60, 240, 1440]; -- minutes: 15m, 1h, 4h, 24h
  v_cooldown_minutes integer;
BEGIN
  -- Idempotency check: if key already used, return previous result
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_attempt
    FROM oferta_ativa_tentativas
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Tentativa já registrada');
    END IF;
  END IF;

  -- Get lead with row lock
  SELECT * INTO v_lead FROM oferta_ativa_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  -- For "com_interesse" delegate to existing exclusive approval
  IF p_resultado = 'com_interesse' THEN
    -- Insert with idempotency key via the existing function logic
    -- Check phone uniqueness
    IF v_lead.telefone_normalizado IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM oferta_ativa_leads
        WHERE telefone_normalizado = v_lead.telefone_normalizado
          AND status = 'aproveitado'
          AND id != p_lead_id
      ) THEN
        RETURN jsonb_build_object('success', false, 'reason', 'phone_already_approved');
      END IF;
    END IF;

    IF v_lead.status = 'aproveitado' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'already_approved');
    END IF;

    INSERT INTO oferta_ativa_tentativas (lead_id, corretor_id, lista_id, empreendimento, canal, resultado, feedback, pontos, idempotency_key)
    VALUES (p_lead_id, p_corretor_id, COALESCE(p_lista_id, v_lead.lista_id), COALESCE(p_empreendimento, v_lead.empreendimento), p_canal, 'com_interesse', p_feedback, 3, p_idempotency_key);

    UPDATE oferta_ativa_leads SET
      status = 'aproveitado',
      corretor_id = p_corretor_id,
      tentativas_count = tentativas_count + 1,
      ultima_tentativa = now(),
      em_atendimento_por = NULL,
      em_atendimento_ate = NULL
    WHERE id = p_lead_id;

    RETURN jsonb_build_object('success', true, 'resultado', 'com_interesse', 'pontos', 3);
  END IF;

  -- Calculate points
  IF p_resultado = 'numero_errado' THEN v_pontos := 0;
  ELSIF p_resultado = 'sem_interesse' THEN v_pontos := 1;
  ELSIF p_resultado = 'nao_atendeu' THEN v_pontos := 1;
  END IF;

  -- Insert attempt
  INSERT INTO oferta_ativa_tentativas (lead_id, corretor_id, lista_id, empreendimento, canal, resultado, feedback, pontos, idempotency_key)
  VALUES (p_lead_id, p_corretor_id, COALESCE(p_lista_id, v_lead.lista_id), COALESCE(p_empreendimento, v_lead.empreendimento), p_canal, p_resultado, p_feedback, v_pontos, p_idempotency_key);

  -- Update lead based on result
  IF p_resultado IN ('numero_errado', 'sem_interesse') THEN
    -- Permanent removal
    UPDATE oferta_ativa_leads SET
      status = 'descartado',
      motivo_descarte = p_resultado,
      tentativas_count = tentativas_count + 1,
      ultima_tentativa = now(),
      em_atendimento_por = NULL,
      em_atendimento_ate = NULL
    WHERE id = p_lead_id;

  ELSIF p_resultado = 'nao_atendeu' THEN
    -- Get lista config
    SELECT * INTO v_lista FROM oferta_ativa_listas WHERE id = COALESCE(p_lista_id, v_lead.lista_id);

    -- Progressive cooldown based on attempt count
    v_cooldown_minutes := v_cooldown_intervals[LEAST(v_lead.tentativas_count + 1, array_length(v_cooldown_intervals, 1))];

    IF v_lead.tentativas_count + 1 >= COALESCE(v_lista.max_tentativas, 3) THEN
      -- Max attempts reached → discard
      UPDATE oferta_ativa_leads SET
        status = 'descartado',
        motivo_descarte = 'max_tentativas',
        tentativas_count = tentativas_count + 1,
        ultima_tentativa = now(),
        em_atendimento_por = NULL,
        em_atendimento_ate = NULL
      WHERE id = p_lead_id;
    ELSE
      -- Progressive cooldown
      UPDATE oferta_ativa_leads SET
        status = 'em_cooldown',
        proxima_tentativa_apos = now() + (v_cooldown_minutes || ' minutes')::interval,
        tentativas_count = tentativas_count + 1,
        ultima_tentativa = now(),
        em_atendimento_por = NULL,
        em_atendimento_ate = NULL
      WHERE id = p_lead_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'resultado', p_resultado, 'pontos', v_pontos, 'visita_marcada', p_visita_marcada);
END;
$$;
