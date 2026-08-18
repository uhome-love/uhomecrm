
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
  v_today            DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
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
        AND (pa.created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today
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

      SELECT
        EXISTS(SELECT 1 FROM public.roleta_presencas rp
                WHERE rp.corretor_id = v_profile_id AND rp.data = v_today
                  AND rp.turno = 'manha' AND rp.status IN ('na_empresa','saiu')),
        EXISTS(SELECT 1 FROM public.roleta_presencas rp
                WHERE rp.corretor_id = v_profile_id AND rp.data = v_today
                  AND rp.turno = 'tarde' AND rp.status IN ('na_empresa','saiu'))
      INTO v_manha, v_tarde;

      IF NOT (v_manha AND v_tarde) THEN
        RETURN jsonb_build_object(
          'bloqueado', true,
          'codigo', 'presenca',
          'titulo', 'Presença do dia não validada',
          'texto', format('A noturna libera após o gestor confirmar sua presença na manhã (%s) e na tarde (%s).',
                          CASE WHEN v_manha THEN 'ok' ELSE 'pendente' END,
                          CASE WHEN v_tarde THEN 'ok' ELSE 'pendente' END),
          'presente_manha', v_manha,
          'presente_tarde', v_tarde
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('bloqueado', false, 'codigo', 'ok', 'titulo', 'Elegível', 'texto', 'Você está apto a se credenciar.');
END;
$function$;
