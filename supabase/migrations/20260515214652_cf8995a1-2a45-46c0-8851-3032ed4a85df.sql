CREATE OR REPLACE FUNCTION public.resolve_corretor_scope_ids(p_corretor_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $function$
  WITH ids AS (
    SELECT p_corretor_id AS id
    UNION
    SELECT p.id
    FROM public.profiles p
    WHERE p.user_id = p_corretor_id
    UNION
    SELECT p.user_id
    FROM public.profiles p
    WHERE p.id = p_corretor_id
      AND p.user_id IS NOT NULL
  )
  SELECT array_agg(DISTINCT id)
  FROM ids;
$function$;

CREATE OR REPLACE FUNCTION public.contar_leads_desatualizados(p_corretor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $function$
  WITH scope_ids AS (
    SELECT unnest(public.resolve_corretor_scope_ids(p_corretor_id)) AS id
  )
  SELECT COUNT(*)::INTEGER
  FROM public.pipeline_leads pl
  JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id IN (SELECT id FROM scope_ids)
    AND COALESCE(pl.arquivado, false) = false
    AND COALESCE(ps.tipo, '') NOT IN ('descarte', 'convertido')
    AND NOT EXISTS (
      SELECT 1
      FROM public.pipeline_tarefas pt
      WHERE pt.pipeline_lead_id = pl.id
        AND pt.status = 'pendente'
    );
$function$;

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
  v_leads_desatualizados := public.contar_leads_desatualizados(p_corretor_id);

  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_leads_desatualizados'), 10)
    INTO v_limite_leads;
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_descartes_mes'), 50)
    INTO v_limite_descartes;
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'visitas_minimas_domingo'), 2)
    INTO v_visitas_min_domingo;

  SELECT p.id INTO v_profile_id
  FROM public.profiles p
  WHERE p.user_id = p_corretor_id
  LIMIT 1;

  SELECT COUNT(*)::INTEGER INTO v_descartes_mes
  FROM public.pipeline_leads pl
  JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(public.resolve_corretor_scope_ids(p_corretor_id))
    AND COALESCE(ps.tipo, '') = 'descarte'
    AND pl.stage_changed_at >= date_trunc('month', CURRENT_DATE)
    AND pl.stage_changed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

  SELECT EXISTS (
    SELECT 1 FROM public.roleta_desbloqueios
    WHERE corretor_id = p_corretor_id
      AND mes = to_char(CURRENT_DATE, 'YYYY-MM')
  ) INTO v_desbloqueio_manual;

  v_bloqueado_descarte := v_descartes_mes >= v_limite_descartes AND NOT v_desbloqueio_manual;
  v_pode_roleta_geral  := v_leads_desatualizados <= v_limite_leads AND NOT v_bloqueado_descarte;

  v_today_brt := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  SELECT EXISTS (
    SELECT 1
    FROM public.pipeline_atividades pa
    WHERE pa.responsavel_id = p_corretor_id
      AND pa.tipo IN ('visita_agendada', 'visita_realizada')
      AND (pa.created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today_brt
    UNION ALL
    SELECT 1
    FROM public.visitas v
    WHERE v.corretor_id IN (p_corretor_id, v_profile_id)
      AND v.data_visita >= v_today_brt
      AND v.status IN ('marcada','confirmada','reagendada','realizada')
    LIMIT 1
  ) INTO v_tem_visita_hoje;

  v_pode_roleta_noturna := v_pode_roleta_geral AND v_tem_visita_hoje;

  v_monday_date := v_today_brt - ((EXTRACT(DOW FROM v_today_brt)::INTEGER + 6) % 7);
  v_saturday_date := v_monday_date + 5;

  SELECT COUNT(*)::INTEGER INTO v_visitas_semana
  FROM public.visitas v
  WHERE v.corretor_id IN (p_corretor_id, v_profile_id)
    AND v.status = 'realizada'
    AND v.data_visita >= v_monday_date
    AND v.data_visita <= v_saturday_date;

  v_pode_domingo := v_pode_roleta_geral AND v_visitas_semana >= v_visitas_min_domingo;

  RETURN json_build_object(
    'leads_desatualizados', v_leads_desatualizados,
    'limite_bloqueio', v_limite_leads,
    'faltam_para_bloquear', GREATEST(0, v_limite_leads - v_leads_desatualizados),
    'pode_entrar_roleta', v_pode_roleta_geral,
    'tem_visita_hoje', v_tem_visita_hoje,
    'pode_roleta_noturna', v_pode_roleta_noturna,
    'pode_roleta_manha', v_pode_roleta_geral,
    'pode_roleta_tarde', v_pode_roleta_geral,
    'descartes_mes', v_descartes_mes,
    'limite_descartes', v_limite_descartes,
    'bloqueado_descarte', v_bloqueado_descarte,
    'desbloqueio_manual', v_desbloqueio_manual,
    'visitas_semana', v_visitas_semana,
    'pode_domingo', v_pode_domingo,
    'visitas_min_domingo', v_visitas_min_domingo,
    'leads_para_atualizar', '[]'::json
  );
END;
$function$;