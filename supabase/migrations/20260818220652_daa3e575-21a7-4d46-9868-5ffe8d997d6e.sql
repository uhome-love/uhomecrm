
CREATE OR REPLACE FUNCTION public.roleta_motivo_bloqueio(p_auth_user_id uuid, p_janela text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_limite_vermelhos INTEGER;
  v_so_noturna       BOOLEAN;
  v_limite_descartes INTEGER;
  v_descartes_mes    INTEGER;
  v_desbloqueio      BOOLEAN;
  v_vermelhos        INTEGER;
  v_tem_visita_hoje  BOOLEAN;
  v_noturna_exige    BOOLEAN;
  v_profile_id       UUID;
  v_manha            BOOLEAN := TRUE;
  v_tarde            BOOLEAN := TRUE;
BEGIN
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_leads_desatualizados'), 10) INTO v_limite_vermelhos;
  SELECT COALESCE((SELECT valor::BOOLEAN FROM public.roleta_config WHERE chave = 'limite_vermelhos_apenas_noturna'), true) INTO v_so_noturna;
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_descartes_mes'), 100) INTO v_limite_descartes;
  SELECT COALESCE((SELECT valor::BOOLEAN FROM public.roleta_config WHERE chave = 'noturna_exige_manha_tarde'), true) INTO v_noturna_exige;

  SELECT COUNT(*)::INTEGER INTO v_descartes_mes
  FROM public.pipeline_leads pl
  JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(public.resolve_corretor_scope_ids(p_auth_user_id))
    AND COALESCE(ps.tipo::text, '') = 'descarte'
    AND pl.stage_changed_at >= date_trunc('month', CURRENT_DATE)
    AND pl.stage_changed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

  SELECT EXISTS (
    SELECT 1 FROM public.roleta_desbloqueios
    WHERE corretor_id = p_auth_user_id AND mes = to_char(CURRENT_DATE, 'YYYY-MM')
  ) INTO v_desbloqueio;

  IF v_descartes_mes >= v_limite_descartes AND NOT v_desbloqueio THEN
    RETURN jsonb_build_object(
      'bloqueado', true,
      'codigo', 'descartes',
      'titulo', 'Teto de descartes do mês atingido',
      'texto', format('Você descartou %s leads este mês (teto: %s). A roleta fica suspensa até o gestor liberar.', v_descartes_mes, v_limite_descartes),
      'descartes_mes', v_descartes_mes,
      'limite_descartes', v_limite_descartes
    );
  END IF;

  IF (NOT v_so_noturna) OR COALESCE(p_janela, '') = 'noturna' THEN
    v_vermelhos := public.contar_leads_vermelhos(p_auth_user_id);
    IF v_vermelhos > v_limite_vermelhos THEN
      RETURN jsonb_build_object(
        'bloqueado', true,
        'codigo', 'vermelhos',
        'titulo', 'Leads vermelhos acima do limite',
        'texto', format('Você tem %s leads vermelhos (limite: %s). Atualize pelo menos %s para liberar.', v_vermelhos, v_limite_vermelhos, v_vermelhos - v_limite_vermelhos),
        'vermelhos', v_vermelhos,
        'limite_vermelhos', v_limite_vermelhos
      );
    END IF;
  END IF;

  IF COALESCE(p_janela, '') = 'noturna' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.pipeline_atividades pa
      WHERE pa.responsavel_id = p_auth_user_id
        AND pa.tipo IN ('visita_agendada', 'visita_realizada')
        AND (pa.created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
    ) INTO v_tem_visita_hoje;

    IF NOT v_tem_visita_hoje THEN
      RETURN jsonb_build_object(
        'bloqueado', true,
        'codigo', 'sem_visita_hoje',
        'titulo', 'Sem visita registrada hoje',
        'texto', 'A roleta noturna exige uma visita marcada ou realizada registrada hoje no pipeline.'
      );
    END IF;

    IF v_noturna_exige THEN
      SELECT p.id INTO v_profile_id FROM public.profiles p WHERE p.user_id = p_auth_user_id;
      IF v_profile_id IS NOT NULL THEN
        SELECT COALESCE(bool_or(rp.turno = 'manha'), false),
               COALESCE(bool_or(rp.turno = 'tarde'), false)
          INTO v_manha, v_tarde
        FROM public.roleta_presencas rp
        WHERE rp.corretor_id = v_profile_id
          AND rp.data = (now() AT TIME ZONE 'America/Sao_Paulo')::date
          AND COALESCE(rp.validado, false) = true;
      END IF;

      IF NOT (v_manha AND v_tarde) THEN
        RETURN jsonb_build_object(
          'bloqueado', true,
          'codigo', 'presenca',
          'titulo', 'Presença do dia não validada',
          'texto', format('A noturna libera após o gestor confirmar sua presença na manhã (%s) e na tarde (%s).',
                          CASE WHEN v_manha THEN 'ok' ELSE 'pendente' END,
                          CASE WHEN v_tarde THEN 'ok' ELSE 'pendente' END)
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('bloqueado', false, 'codigo', 'ok', 'titulo', 'Elegível', 'texto', 'Você está apto a se credenciar.');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('bloqueado', false, 'codigo', 'erro', 'titulo', 'Indisponível', 'texto', 'Não foi possível calcular o motivo.');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.roleta_motivo_bloqueio(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.credenciar_na_roleta(p_corretor_id uuid, p_auth_user_id uuid, p_janela text, p_segmento_1_id uuid, p_segmento_2_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pode BOOLEAN;
  v_cred_id UUID;
  v_hoje DATE := CURRENT_DATE;
  v_max_pos INTEGER;
  v_motivo JSONB;
  v_nome TEXT;
  v_dest UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_corretor_id AND user_id = p_auth_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Profile não pertence ao usuário');
  END IF;

  v_pode := corretor_pode_entrar_roleta(p_auth_user_id, p_janela);
  IF NOT v_pode THEN
    v_motivo := public.roleta_motivo_bloqueio(p_auth_user_id, p_janela);
    SELECT nome INTO v_nome FROM profiles WHERE id = p_corretor_id;

    BEGIN
      FOR v_dest IN
        SELECT DISTINCT u FROM (
          SELECT tm.gerente_id AS u
          FROM team_members tm
          WHERE tm.user_id = p_auth_user_id AND tm.status = 'ativo'
          UNION
          SELECT ur.user_id FROM user_roles ur WHERE ur.role IN ('admin', 'diretor')
        ) d
        WHERE u IS NOT NULL
      LOOP
        PERFORM public.criar_notificacao(
          v_dest,
          'alerta',
          'roleta_bloqueio',
          format('%s bloqueado na roleta %s', COALESCE(v_nome, 'Corretor'), p_janela),
          format('%s: %s', v_motivo->>'titulo', v_motivo->>'texto'),
          jsonb_build_object(
            'corretor_id', p_corretor_id,
            'auth_user_id', p_auth_user_id,
            'janela', p_janela,
            'motivo', v_motivo
          ),
          'roleta_bloqueio:' || p_auth_user_id::text || ':' || p_janela || ':' || v_hoje::text
        );
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN json_build_object(
      'success', false,
      'error', format('%s — %s', v_motivo->>'titulo', v_motivo->>'texto'),
      'motivo', v_motivo
    );
  END IF;

  INSERT INTO roleta_credenciamentos (
    corretor_id, auth_user_id, data, janela,
    segmento_1_id, segmento_2_id, status
  ) VALUES (
    p_corretor_id, p_auth_user_id, v_hoje, p_janela,
    p_segmento_1_id, p_segmento_2_id, 'aprovado'
  )
  ON CONFLICT (corretor_id, data, janela)
  DO UPDATE SET
    segmento_1_id = EXCLUDED.segmento_1_id,
    segmento_2_id = EXCLUDED.segmento_2_id,
    status = 'aprovado',
    saiu_em = NULL
  RETURNING id INTO v_cred_id;

  SELECT COALESCE(MAX(posicao), 0) INTO v_max_pos
  FROM roleta_fila WHERE data = v_hoje AND janela = p_janela AND ativo = true;

  INSERT INTO roleta_fila (credenciamento_id, corretor_id, segmento_id, data, janela, posicao, ativo)
  VALUES (v_cred_id, p_corretor_id, p_segmento_1_id, v_hoje, p_janela, v_max_pos + 1, true)
  ON CONFLICT DO NOTHING;

  IF p_segmento_2_id IS NOT NULL THEN
    INSERT INTO roleta_fila (credenciamento_id, corretor_id, segmento_id, data, janela, posicao, ativo)
    VALUES (v_cred_id, p_corretor_id, p_segmento_2_id, v_hoje, p_janela, v_max_pos + 2, true)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE corretor_disponibilidade
  SET na_roleta = true, updated_at = NOW()
  WHERE user_id = p_auth_user_id;

  IF NOT FOUND THEN
    INSERT INTO corretor_disponibilidade (user_id, na_roleta, status, updated_at)
    VALUES (p_auth_user_id, true, 'online', NOW())
    ON CONFLICT (user_id) DO UPDATE SET na_roleta = true, updated_at = NOW();
  END IF;

  RETURN json_build_object(
    'success', true,
    'credenciamento_id', v_cred_id,
    'status', 'aprovado',
    'message', 'Credenciamento aprovado! Você está na roleta.'
  );
END;
$function$;
