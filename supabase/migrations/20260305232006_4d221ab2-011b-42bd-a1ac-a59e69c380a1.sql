
CREATE OR REPLACE FUNCTION public.finalizar_tentativa_v2(p_lead_id uuid, p_corretor_id uuid, p_canal text, p_resultado text, p_feedback text, p_lista_id uuid DEFAULT NULL::uuid, p_empreendimento text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text, p_visita_marcada boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead oferta_ativa_leads%ROWTYPE;
  v_lista oferta_ativa_listas%ROWTYPE;
  v_existing_attempt uuid;
  v_attempt_id uuid;
  v_pontos integer := 1;
  v_cooldown_intervals integer[] := ARRAY[15, 60, 240, 1440];
  v_cooldown_minutes integer;
  v_team_member record;
  v_checkpoint record;
  v_today date := CURRENT_DATE;
BEGIN
  -- Idempotency check
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

  -- Handle "com_interesse" (approval)
  IF p_resultado = 'com_interesse' THEN
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
    VALUES (p_lead_id, p_corretor_id, COALESCE(p_lista_id, v_lead.lista_id), COALESCE(p_empreendimento, v_lead.empreendimento), p_canal, 'com_interesse', p_feedback, 3, p_idempotency_key)
    RETURNING id INTO v_attempt_id;

    UPDATE oferta_ativa_leads SET
      status = 'aproveitado',
      corretor_id = p_corretor_id,
      tentativas_count = tentativas_count + 1,
      ultima_tentativa = now(),
      em_atendimento_por = NULL,
      em_atendimento_ate = NULL
    WHERE id = p_lead_id;

    -- Log event
    INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
    VALUES ('call_finished', p_corretor_id, p_lead_id, COALESCE(p_lista_id, v_lead.lista_id), v_attempt_id,
      jsonb_build_object('resultado', 'com_interesse', 'canal', p_canal, 'pontos', 3, 'visita_marcada', p_visita_marcada));

    -- AUTO-SYNC: If visita_marcada, update checkpoint_lines automatically
    IF p_visita_marcada THEN
      SELECT tm.id, tm.gerente_id INTO v_team_member
      FROM team_members tm
      WHERE tm.user_id = p_corretor_id AND tm.status = 'ativo'
      LIMIT 1;

      IF FOUND THEN
        SELECT id INTO v_checkpoint
        FROM checkpoints
        WHERE gerente_id = v_team_member.gerente_id AND data = v_today;

        IF NOT FOUND THEN
          INSERT INTO checkpoints (gerente_id, data)
          VALUES (v_team_member.gerente_id, v_today)
          RETURNING id INTO v_checkpoint;
        END IF;

        -- Upsert checkpoint_line: increment real_visitas_marcadas
        INSERT INTO checkpoint_lines (checkpoint_id, corretor_id, real_visitas_marcadas)
        VALUES (v_checkpoint.id, v_team_member.id, 1)
        ON CONFLICT (checkpoint_id, corretor_id)
        DO UPDATE SET
          real_visitas_marcadas = COALESCE(checkpoint_lines.real_visitas_marcadas, 0) + 1,
          updated_at = now();
      END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'resultado', 'com_interesse', 'pontos', 3, 'attempt_id', v_attempt_id, 'visita_marcada', p_visita_marcada);
  END IF;

  -- Calculate points
  IF p_resultado = 'numero_errado' THEN v_pontos := 0;
  ELSIF p_resultado = 'sem_interesse' THEN v_pontos := 1;
  ELSIF p_resultado = 'nao_atendeu' THEN v_pontos := 1;
  END IF;

  -- Insert attempt
  INSERT INTO oferta_ativa_tentativas (lead_id, corretor_id, lista_id, empreendimento, canal, resultado, feedback, pontos, idempotency_key)
  VALUES (p_lead_id, p_corretor_id, COALESCE(p_lista_id, v_lead.lista_id), COALESCE(p_empreendimento, v_lead.empreendimento), p_canal, p_resultado, p_feedback, v_pontos, p_idempotency_key)
  RETURNING id INTO v_attempt_id;

  -- Update lead based on result
  IF p_resultado IN ('numero_errado', 'sem_interesse') THEN
    UPDATE oferta_ativa_leads SET
      status = 'descartado',
      motivo_descarte = p_resultado,
      tentativas_count = tentativas_count + 1,
      ultima_tentativa = now(),
      em_atendimento_por = NULL,
      em_atendimento_ate = NULL
    WHERE id = p_lead_id;

    INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
    VALUES ('lead_discarded', p_corretor_id, p_lead_id, COALESCE(p_lista_id, v_lead.lista_id), v_attempt_id,
      jsonb_build_object('motivo', p_resultado, 'canal', p_canal));

  ELSIF p_resultado = 'nao_atendeu' THEN
    SELECT * INTO v_lista FROM oferta_ativa_listas WHERE id = COALESCE(p_lista_id, v_lead.lista_id);
    v_cooldown_minutes := v_cooldown_intervals[LEAST(v_lead.tentativas_count + 1, array_length(v_cooldown_intervals, 1))];

    IF v_lead.tentativas_count + 1 >= COALESCE(v_lista.max_tentativas, 3) THEN
      UPDATE oferta_ativa_leads SET
        status = 'descartado',
        motivo_descarte = 'max_tentativas',
        tentativas_count = tentativas_count + 1,
        ultima_tentativa = now(),
        em_atendimento_por = NULL,
        em_atendimento_ate = NULL
      WHERE id = p_lead_id;

      INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
      VALUES ('lead_discarded', p_corretor_id, p_lead_id, COALESCE(p_lista_id, v_lead.lista_id), v_attempt_id,
        jsonb_build_object('motivo', 'max_tentativas', 'tentativas', v_lead.tentativas_count + 1));
    ELSE
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

  -- Log finish event
  INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
  VALUES ('call_finished', p_corretor_id, p_lead_id, COALESCE(p_lista_id, v_lead.lista_id), v_attempt_id,
    jsonb_build_object('resultado', p_resultado, 'canal', p_canal, 'pontos', v_pontos, 'visita_marcada', p_visita_marcada));

  RETURN jsonb_build_object('success', true, 'resultado', p_resultado, 'pontos', v_pontos, 'visita_marcada', p_visita_marcada, 'attempt_id', v_attempt_id);
END;
$function$;
