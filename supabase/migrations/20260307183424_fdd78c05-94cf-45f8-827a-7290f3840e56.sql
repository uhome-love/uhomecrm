
-- 1. Add interesse_tipo column to oferta_ativa_leads
ALTER TABLE public.oferta_ativa_leads 
ADD COLUMN IF NOT EXISTS interesse_tipo text DEFAULT NULL;

-- 2. Update finalizar_tentativa_v2 to accept and store interesse_tipo
CREATE OR REPLACE FUNCTION public.finalizar_tentativa_v2(
  p_lead_id uuid, p_corretor_id uuid, p_canal text, p_resultado text, p_feedback text,
  p_lista_id uuid DEFAULT NULL, p_empreendimento text DEFAULT NULL, 
  p_idempotency_key text DEFAULT NULL, p_visita_marcada boolean DEFAULT false,
  p_interesse_tipo text DEFAULT NULL
)
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
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_total_tentativas int;
  v_total_aproveitados int;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_attempt FROM oferta_ativa_tentativas WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Tentativa já registrada');
    END IF;
  END IF;

  SELECT * INTO v_lead FROM oferta_ativa_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  -- Handle "com_interesse" (approval)
  IF p_resultado = 'com_interesse' THEN
    IF v_lead.telefone_normalizado IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM oferta_ativa_leads
        WHERE telefone_normalizado = v_lead.telefone_normalizado AND status = 'aproveitado' AND id != p_lead_id
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
      interesse_tipo = COALESCE(p_interesse_tipo, 'com_interesse'),
      tentativas_count = tentativas_count + 1,
      ultima_tentativa = now(),
      em_atendimento_por = NULL,
      em_atendimento_ate = NULL
    WHERE id = p_lead_id;

    INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
    VALUES ('call_finished', p_corretor_id, p_lead_id, COALESCE(p_lista_id, v_lead.lista_id), v_attempt_id,
      jsonb_build_object('resultado', 'com_interesse', 'canal', p_canal, 'pontos', 3, 'visita_marcada', p_visita_marcada, 'interesse_tipo', p_interesse_tipo));

    -- AUTO-SYNC visitas marcadas to checkpoint
    IF p_visita_marcada THEN
      SELECT tm.id, tm.gerente_id INTO v_team_member
      FROM team_members tm WHERE tm.user_id = p_corretor_id AND tm.status = 'ativo' LIMIT 1;

      IF FOUND THEN
        SELECT id INTO v_checkpoint FROM checkpoints WHERE gerente_id = v_team_member.gerente_id AND data = v_today;
        IF NOT FOUND THEN
          INSERT INTO checkpoints (gerente_id, data) VALUES (v_team_member.gerente_id, v_today) RETURNING id INTO v_checkpoint;
        END IF;
        INSERT INTO checkpoint_lines (checkpoint_id, corretor_id, real_visitas_marcadas)
        VALUES (v_checkpoint.id, v_team_member.id, 1)
        ON CONFLICT (checkpoint_id, corretor_id)
        DO UPDATE SET real_visitas_marcadas = COALESCE(checkpoint_lines.real_visitas_marcadas, 0) + 1, updated_at = now();
      END IF;
    END IF;

  ELSE
    IF p_resultado = 'numero_errado' THEN v_pontos := 0;
    ELSIF p_resultado = 'sem_interesse' THEN v_pontos := 1;
    ELSIF p_resultado = 'nao_atendeu' THEN v_pontos := 1;
    END IF;

    INSERT INTO oferta_ativa_tentativas (lead_id, corretor_id, lista_id, empreendimento, canal, resultado, feedback, pontos, idempotency_key)
    VALUES (p_lead_id, p_corretor_id, COALESCE(p_lista_id, v_lead.lista_id), COALESCE(p_empreendimento, v_lead.empreendimento), p_canal, p_resultado, p_feedback, v_pontos, p_idempotency_key)
    RETURNING id INTO v_attempt_id;

    IF p_resultado IN ('numero_errado', 'sem_interesse') THEN
      UPDATE oferta_ativa_leads SET
        status = 'descartado', motivo_descarte = p_resultado,
        tentativas_count = tentativas_count + 1, ultima_tentativa = now(),
        em_atendimento_por = NULL, em_atendimento_ate = NULL
      WHERE id = p_lead_id;

      INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
      VALUES ('lead_discarded', p_corretor_id, p_lead_id, COALESCE(p_lista_id, v_lead.lista_id), v_attempt_id,
        jsonb_build_object('motivo', p_resultado, 'canal', p_canal));

    ELSIF p_resultado = 'nao_atendeu' THEN
      SELECT * INTO v_lista FROM oferta_ativa_listas WHERE id = COALESCE(p_lista_id, v_lead.lista_id);
      v_cooldown_minutes := v_cooldown_intervals[LEAST(v_lead.tentativas_count + 1, array_length(v_cooldown_intervals, 1))];

      IF v_lead.tentativas_count + 1 >= COALESCE(v_lista.max_tentativas, 3) THEN
        UPDATE oferta_ativa_leads SET
          status = 'descartado', motivo_descarte = 'max_tentativas',
          tentativas_count = tentativas_count + 1, ultima_tentativa = now(),
          em_atendimento_por = NULL, em_atendimento_ate = NULL
        WHERE id = p_lead_id;

        INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
        VALUES ('lead_discarded', p_corretor_id, p_lead_id, COALESCE(p_lista_id, v_lead.lista_id), v_attempt_id,
          jsonb_build_object('motivo', 'max_tentativas', 'tentativas', v_lead.tentativas_count + 1));
      ELSE
        UPDATE oferta_ativa_leads SET
          status = 'em_cooldown',
          proxima_tentativa_apos = now() + (v_cooldown_minutes || ' minutes')::interval,
          tentativas_count = tentativas_count + 1, ultima_tentativa = now(),
          em_atendimento_por = NULL, em_atendimento_ate = NULL
        WHERE id = p_lead_id;
      END IF;
    END IF;

    INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
    VALUES ('call_finished', p_corretor_id, p_lead_id, COALESCE(p_lista_id, v_lead.lista_id), v_attempt_id,
      jsonb_build_object('resultado', p_resultado, 'canal', p_canal, 'pontos', v_pontos, 'visita_marcada', p_visita_marcada));
  END IF;

  -- AUTO-SYNC checkpoint_lines
  SELECT tm.id, tm.gerente_id INTO v_team_member
  FROM team_members tm WHERE tm.user_id = p_corretor_id AND tm.status = 'ativo' LIMIT 1;

  IF FOUND THEN
    v_day_start := (v_today::text || 'T00:00:00-03:00')::timestamptz;
    v_day_end := (v_today::text || 'T23:59:59.999-03:00')::timestamptz;

    SELECT COUNT(*), COUNT(*) FILTER (WHERE resultado = 'com_interesse')
    INTO v_total_tentativas, v_total_aproveitados
    FROM oferta_ativa_tentativas
    WHERE corretor_id = p_corretor_id AND created_at >= v_day_start AND created_at <= v_day_end;

    SELECT id INTO v_checkpoint FROM checkpoints WHERE gerente_id = v_team_member.gerente_id AND data = v_today;
    IF NOT FOUND THEN
      INSERT INTO checkpoints (gerente_id, data) VALUES (v_team_member.gerente_id, v_today) RETURNING id INTO v_checkpoint;
    END IF;

    INSERT INTO checkpoint_lines (checkpoint_id, corretor_id, real_ligacoes, real_leads)
    VALUES (v_checkpoint.id, v_team_member.id, v_total_tentativas, v_total_aproveitados)
    ON CONFLICT (checkpoint_id, corretor_id)
    DO UPDATE SET real_ligacoes = EXCLUDED.real_ligacoes, real_leads = EXCLUDED.real_leads, updated_at = now();
  END IF;

  RETURN jsonb_build_object('success', true, 'resultado', COALESCE(p_resultado, 'com_interesse'), 'pontos', COALESCE(v_pontos, 3), 'visita_marcada', p_visita_marcada, 'attempt_id', v_attempt_id, 'interesse_tipo', p_interesse_tipo);
END;
$function$;

-- 3. Update oa_aproveitado_to_pipeline trigger to use interesse_tipo for stage mapping
CREATE OR REPLACE FUNCTION public.oa_aproveitado_to_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_id uuid;
  v_stage_tipo text;
BEGIN
  IF NEW.status <> 'aproveitado' THEN RETURN NEW; END IF;
  IF OLD.status = 'aproveitado' THEN RETURN NEW; END IF;

  -- Map interesse_tipo to pipeline stage type
  v_stage_tipo := CASE COALESCE(NEW.interesse_tipo, 'com_interesse')
    WHEN 'pediu_informacoes' THEN 'contato_inicial'
    WHEN 'demonstrou_interesse' THEN 'atendimento'
    WHEN 'quer_visitar' THEN 'possibilidade_visita'
    WHEN 'visita_marcada' THEN 'visita_marcada'
    ELSE 'contato_inicial'  -- default: contato_inicial (not novo_lead, since they already had contact)
  END;

  -- Get the target stage
  SELECT id INTO v_stage_id
  FROM pipeline_stages
  WHERE tipo = v_stage_tipo AND ativo = true
  LIMIT 1;

  -- Fallback to novo_lead if target stage not found
  IF v_stage_id IS NULL THEN
    SELECT id INTO v_stage_id
    FROM pipeline_stages
    WHERE tipo = 'novo_lead' AND ativo = true
    LIMIT 1;
  END IF;

  IF v_stage_id IS NULL THEN RETURN NEW; END IF;

  -- Check dedup by phone
  IF NEW.telefone_normalizado IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pipeline_leads
      WHERE (telefone = NEW.telefone OR telefone = NEW.telefone_normalizado)
      LIMIT 1
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Insert into pipeline_leads with correct stage
  INSERT INTO pipeline_leads (
    nome, telefone, telefone2, email, empreendimento,
    stage_id, corretor_id, origem, origem_detalhe,
    observacoes, created_by
  ) VALUES (
    NEW.nome, NEW.telefone, NEW.telefone2, NEW.email, NEW.empreendimento,
    v_stage_id, NEW.corretor_id, 'Oferta Ativa',
    COALESCE(NEW.campanha, NEW.origem, 'Reativação'),
    'Lead reativado via Oferta Ativa (' || COALESCE(NEW.interesse_tipo, 'com_interesse') || '). Lista: ' || COALESCE(
      (SELECT nome FROM oferta_ativa_listas WHERE id = NEW.lista_id), 'N/A'
    ) || '. Tentativas: ' || NEW.tentativas_count::text,
    NEW.corretor_id
  );

  RETURN NEW;
END;
$function$;
