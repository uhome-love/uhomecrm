CREATE OR REPLACE FUNCTION public.get_elegibilidade_roleta(p_corretor_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_leads_desatualizados  INTEGER;
  v_pode_roleta_geral     BOOLEAN;
  v_tem_visita_hoje       BOOLEAN;
  v_pode_roleta_noturna   BOOLEAN;
  v_descartes_mes         INTEGER;
  v_bloqueado_descarte    BOOLEAN;
  v_visitas_semana        INTEGER;
  v_pode_domingo          BOOLEAN;
  v_limite_leads          INTEGER;
  v_limite_descartes      INTEGER;
  v_visitas_min_domingo   INTEGER;
  v_monday_date           DATE;
  v_saturday_date         DATE;
  v_today_brt             DATE;
  v_profile_id            UUID;
  v_desbloqueio_manual    BOOLEAN;
BEGIN
  v_leads_desatualizados := contar_leads_desatualizados(p_corretor_id);

  SELECT COALESCE((SELECT valor::INTEGER FROM roleta_config WHERE chave = 'limite_leads_desatualizados'), 10) INTO v_limite_leads;
  SELECT COALESCE((SELECT valor::INTEGER FROM roleta_config WHERE chave = 'limite_descartes_mes'), 50) INTO v_limite_descartes;
  SELECT COALESCE((SELECT valor::INTEGER FROM roleta_config WHERE chave = 'visitas_minimas_domingo'), 2) INTO v_visitas_min_domingo;

  SELECT COUNT(*)::INTEGER INTO v_descartes_mes
  FROM pipeline_leads pl
  WHERE pl.corretor_id = p_corretor_id
    AND pl.stage_id = '1dd66c25-3848-4053-9f66-82e902989b4d'
    AND pl.stage_changed_at >= date_trunc('month', CURRENT_DATE)
    AND pl.stage_changed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

  SELECT EXISTS (
    SELECT 1 FROM roleta_desbloqueios
    WHERE corretor_id = p_corretor_id
      AND mes = to_char(CURRENT_DATE, 'YYYY-MM')
  ) INTO v_desbloqueio_manual;

  v_bloqueado_descarte := v_descartes_mes >= v_limite_descartes AND NOT v_desbloqueio_manual;
  v_pode_roleta_geral  := v_leads_desatualizados <= v_limite_leads AND NOT v_bloqueado_descarte;

  v_today_brt := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  -- FIX: pipeline_atividades não tem coluna corretor_id; usar responsavel_id
  -- E também aceitar visitas registradas em public.visitas (BRT)
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = p_corretor_id LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM pipeline_atividades pa
    WHERE pa.responsavel_id = p_corretor_id
      AND pa.tipo IN ('visita_agendada', 'visita_realizada')
      AND (pa.created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today_brt
    UNION ALL
    SELECT 1
    FROM visitas v
    WHERE v.corretor_id IN (p_corretor_id, v_profile_id)
      AND v.data_visita >= v_today_brt
      AND v.status IN ('marcada','confirmada','reagendada','realizada')
    LIMIT 1
  ) INTO v_tem_visita_hoje;

  v_pode_roleta_noturna := v_pode_roleta_geral AND v_tem_visita_hoje;

  v_monday_date := v_today_brt - ((EXTRACT(DOW FROM v_today_brt)::INTEGER + 6) % 7);
  v_saturday_date := v_monday_date + 5;

  SELECT COUNT(*)::INTEGER INTO v_visitas_semana
  FROM visitas v
  WHERE v.corretor_id IN (p_corretor_id, v_profile_id)
    AND v.status = 'realizada'
    AND v.data_visita >= v_monday_date
    AND v.data_visita <= v_saturday_date;

  v_pode_domingo := v_pode_roleta_geral AND v_visitas_semana >= v_visitas_min_domingo;

  RETURN json_build_object(
    'leads_desatualizados', v_leads_desatualizados,
    'limite_bloqueio', v_limite_leads,
    'pode_entrar_roleta', v_pode_roleta_geral,
    'tem_visita_hoje', v_tem_visita_hoje,
    'pode_roleta_noturna', v_pode_roleta_noturna,
    'descartes_mes', v_descartes_mes,
    'limite_descartes', v_limite_descartes,
    'bloqueado_descarte', v_bloqueado_descarte,
    'desbloqueio_manual', v_desbloqueio_manual,
    'visitas_semana', v_visitas_semana,
    'pode_domingo', v_pode_domingo,
    'visitas_min_domingo', v_visitas_min_domingo
  );
END;
$function$;