-- Migration B — Fase 1A · Ponte do Aproveitado dentro de finalizar_tentativa_v2
-- ============================================================================
-- ROLLBACK: o corpo anterior de finalizar_tentativa_v2 (overload de 10 args
-- com p_interesse_tipo) está preservado em /tmp/ftv2.sql no ambiente de dev
-- (linhas 184-366 do dump gerado em 26/07/2026 antes desta migration).
-- Overload legada de 9 args (sem p_interesse_tipo) é removida aqui pois
-- estava obsoleta e não é chamada pelo app.
-- ============================================================================

-- Remove overload legada de 9 args (sem p_interesse_tipo) para evitar ambiguidade.
DROP FUNCTION IF EXISTS public.finalizar_tentativa_v2(
  uuid, uuid, text, text, text, uuid, text, text, boolean
);

CREATE OR REPLACE FUNCTION public.finalizar_tentativa_v2(
  p_lead_id uuid,
  p_corretor_id uuid,
  p_canal text,
  p_resultado text,
  p_feedback text,
  p_lista_id uuid DEFAULT NULL::uuid,
  p_empreendimento text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_visita_marcada boolean DEFAULT false,
  p_interesse_tipo text DEFAULT NULL::text
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
  -- Ponte
  v_bridge_tel text;
  v_bridge_email text;
  v_bridge_pl_id uuid;
  v_bridge_status text := 'skipped';
  v_bridge_stage_id uuid;
  v_bridge_obs text;
  v_bridge_auth uuid;
BEGIN
  -- Idempotency check (retorna resposta cacheada — não reprocessa a ponte)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_attempt
    FROM oferta_ativa_tentativas
    WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'message', 'Tentativa já registrada',
        'attempt_id', v_existing_attempt
      );
    END IF;
  END IF;

  SELECT * INTO v_lead FROM oferta_ativa_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF p_resultado = 'com_interesse' THEN
    -- Bloqueia duplicação dentro da própria oferta ativa
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

    INSERT INTO oferta_ativa_tentativas (
      lead_id, corretor_id, lista_id, empreendimento, canal, resultado, feedback, pontos, idempotency_key
    ) VALUES (
      p_lead_id, p_corretor_id, COALESCE(p_lista_id, v_lead.lista_id),
      COALESCE(p_empreendimento, v_lead.empreendimento), p_canal, 'com_interesse',
      p_feedback, 3, p_idempotency_key
    )
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
    VALUES (
      'call_finished', p_corretor_id, p_lead_id, COALESCE(p_lista_id, v_lead.lista_id), v_attempt_id,
      jsonb_build_object(
        'resultado', 'com_interesse', 'canal', p_canal, 'pontos', 3,
        'visita_marcada', p_visita_marcada, 'interesse_tipo', p_interesse_tipo
      )
    );

    -- ═══════════════════════════════════════════════════════════════════
    -- PONTE DO APROVEITADO → pipeline_leads
    -- Dedup alinhado ao índice único parcial: aceite_status <> 'descartado'
    -- (sem filtro por arquivado ou stage). A constraint é a fonte de verdade.
    -- ═══════════════════════════════════════════════════════════════════
    BEGIN
      v_bridge_tel := public.normalize_telefone(v_lead.telefone);
      v_bridge_email := NULLIF(lower(btrim(v_lead.email)), '');

      -- Log divergência entre p_corretor_id e auth.uid() (não sobrescreve)
      v_bridge_auth := auth.uid();
      IF v_bridge_auth IS NOT NULL AND v_bridge_auth <> p_corretor_id THEN
        BEGIN
          INSERT INTO ops_events (fn, level, category, message, ctx)
          VALUES (
            'finalizar_tentativa_v2', 'warn', 'bridge_aproveitado',
            'auth.uid() difere de p_corretor_id',
            jsonb_build_object(
              'p_corretor_id', p_corretor_id,
              'auth_uid', v_bridge_auth,
              'attempt_id', v_attempt_id
            )
          );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;

      -- Busca lead ativo por telefone (sob predicado do índice único)
      IF v_bridge_tel IS NOT NULL THEN
        SELECT id INTO v_bridge_pl_id
        FROM pipeline_leads
        WHERE telefone_normalizado = v_bridge_tel
          AND aceite_status <> 'descartado'
        ORDER BY created_at DESC
        LIMIT 1;
      END IF;

      -- Se não achou por telefone, tenta por e-mail
      IF v_bridge_pl_id IS NULL AND v_bridge_email IS NOT NULL THEN
        SELECT id INTO v_bridge_pl_id
        FROM pipeline_leads
        WHERE lower(email) = v_bridge_email
          AND aceite_status <> 'descartado'
        ORDER BY created_at DESC
        LIMIT 1;
      END IF;

      IF v_bridge_pl_id IS NOT NULL THEN
        -- EXISTS: retorna id, NÃO escreve no lead encontrado.
        v_bridge_status := 'exists';
      ELSE
        -- CREATED: insere novo lead em Novo Lead
        SELECT id INTO v_bridge_stage_id
        FROM pipeline_stages
        WHERE ativo = true AND nome = 'Novo Lead'
        LIMIT 1;

        -- Observação estruturada
        v_bridge_obs := format(
          E'Lead criado via Oferta Ativa (Aproveitado).\nInteresse: %s\nFeedback: %s',
          COALESCE(p_interesse_tipo, 'com_interesse'),
          COALESCE(p_feedback, '(sem feedback)')
        );

        INSERT INTO pipeline_leads (
          nome, telefone, email, empreendimento,
          origem, corretor_id, stage_id, observacoes,
          aceite_status
        ) VALUES (
          COALESCE(v_lead.nome, 'Sem nome'),
          v_lead.telefone,
          v_lead.email,
          COALESCE(p_empreendimento, v_lead.empreendimento),
          'Oferta Ativa',
          p_corretor_id,
          v_bridge_stage_id,  -- se NULL → not_null_violation, cai no handler
          v_bridge_obs,
          'aceito'
        )
        RETURNING id INTO v_bridge_pl_id;

        v_bridge_status := 'created';
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        v_bridge_status := 'failed';
        v_bridge_pl_id := NULL;
        BEGIN
          INSERT INTO ops_events (fn, level, category, message, ctx)
          VALUES (
            'finalizar_tentativa_v2',
            'error',
            'bridge_aproveitado',
            COALESCE(NULLIF(SQLERRM, ''), 'erro desconhecido na ponte'),
            jsonb_build_object(
              'attempt_id', v_attempt_id,
              'oa_lead_id', p_lead_id,
              'p_corretor_id', p_corretor_id,
              'sqlstate', SQLSTATE,
              'telefone_normalizado', v_bridge_tel
            )
          );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END;
    -- ═══ FIM DA PONTE ═══

    -- AUTO-SYNC visitas marcadas → checkpoint
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

    INSERT INTO oferta_ativa_tentativas (
      lead_id, corretor_id, lista_id, empreendimento, canal, resultado, feedback, pontos, idempotency_key
    ) VALUES (
      p_lead_id, p_corretor_id, COALESCE(p_lista_id, v_lead.lista_id),
      COALESCE(p_empreendimento, v_lead.empreendimento), p_canal, p_resultado,
      p_feedback, v_pontos, p_idempotency_key
    )
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

  RETURN jsonb_build_object(
    'success', true,
    'resultado', COALESCE(p_resultado, 'com_interesse'),
    'pontos', COALESCE(v_pontos, 3),
    'visita_marcada', p_visita_marcada,
    'attempt_id', v_attempt_id,
    'interesse_tipo', p_interesse_tipo,
    'pipeline_status', v_bridge_status,
    'pipeline_lead_id', v_bridge_pl_id
  );
END;
$function$;