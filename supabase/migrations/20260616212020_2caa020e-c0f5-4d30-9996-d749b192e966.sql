CREATE OR REPLACE FUNCTION public.get_dashboard_gerente_v4_kpis(p_gestor_id uuid, p_periodo text DEFAULT 'hoje'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now         timestamptz := now();
  v_today       date := (v_now AT TIME ZONE 'America/Sao_Paulo')::date;
  v_p_start     date;
  v_p_end       date;
  v_prev_start  date;
  v_prev_end    date;
  v_mes_key     text;
  v_meta        record;
  v_team_auth   uuid[];
  v_team_prof   uuid[];
  v_gestor_prof uuid;
  v_result      jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF auth.uid() <> p_gestor_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_periodo = 'hoje' THEN
    v_p_start := v_today;                        v_p_end    := v_today;
    v_prev_start := v_today - INTERVAL '7 days'; v_prev_end := v_today - INTERVAL '7 days';
  ELSIF p_periodo = 'semana' THEN
    v_p_start := date_trunc('week', v_today)::date;
    v_p_end   := (date_trunc('week', v_today) + INTERVAL '6 days')::date;
    v_prev_start := (date_trunc('week', v_today) - INTERVAL '7 days')::date;
    v_prev_end   := (date_trunc('week', v_today) - INTERVAL '1 day')::date;
  ELSE
    v_p_start := date_trunc('month', v_today)::date;
    v_p_end   := (date_trunc('month', v_today) + INTERVAL '1 month - 1 day')::date;
    v_prev_start := (date_trunc('month', v_today) - INTERVAL '1 month')::date;
    v_prev_end   := (date_trunc('month', v_today) - INTERVAL '1 day')::date;
  END IF;

  v_mes_key := to_char(v_today, 'YYYY-MM');

  SELECT array_agg(user_id) INTO v_team_auth
  FROM public.resolve_managed_brokers(p_gestor_id);
  IF v_team_auth IS NULL THEN v_team_auth := ARRAY[]::uuid[]; END IF;

  SELECT array_agg(id) INTO v_team_prof
  FROM profiles WHERE user_id = ANY(v_team_auth);
  IF v_team_prof IS NULL THEN v_team_prof := ARRAY[]::uuid[]; END IF;

  -- profile id do próprio gestor (negócios em que ele é o gerente responsável)
  SELECT id INTO v_gestor_prof FROM profiles WHERE user_id = p_gestor_id LIMIT 1;

  SELECT * INTO v_meta FROM ceo_metas_mensais
  WHERE gerente_id = p_gestor_id AND mes = v_mes_key LIMIT 1;
  IF v_meta IS NULL THEN
    v_meta.meta_vgv_assinado := 0;
    v_meta.meta_leads := 400;
    v_meta.meta_visitas_realizadas := 0;
    v_meta.meta_negocios := 90;
  END IF;

  WITH
  vendas_atual AS (
    SELECT COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)),0)::numeric AS v,
           COUNT(*)::int AS qtd
    FROM negocios n
    WHERE (n.corretor_id = ANY(v_team_prof) OR n.gerente_id = v_gestor_prof)
      AND n.data_assinatura BETWEEN v_p_start AND v_p_end
  ),
  vendas_prev AS (
    SELECT COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)),0)::numeric AS v,
           COUNT(*)::int AS qtd
    FROM negocios n
    WHERE (n.corretor_id = ANY(v_team_prof) OR n.gerente_id = v_gestor_prof)
      AND n.data_assinatura BETWEEN v_prev_start AND v_prev_end
  ),
  leads_atual AS (
    SELECT COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN v_p_start AND v_p_end
  ),
  leads_prev AS (
    SELECT COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN v_prev_start AND v_prev_end
  ),
  visitas_atual AS (
    SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND data_visita BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead')
      AND status = 'realizada'
  ),
  visitas_prev AS (
    SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND data_visita BETWEEN v_prev_start AND v_prev_end
      AND (tipo IS NULL OR tipo = 'lead')
      AND status = 'realizada'
  ),
  visitas_agendadas AS (
    SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead')
      AND status IN ('agendada','marcada','confirmada')
  ),
  visitas_total AS (
    SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead')
  ),
  negocios_ativos_total AS (
    SELECT COUNT(*)::int AS qtd FROM negocios
    WHERE (corretor_id = ANY(v_team_prof) OR gerente_id = v_gestor_prof)
      AND status = 'ativo'
      AND fase NOT IN ('vendido','distrato','perdido')
  ),
  tarefas_atr AS (
    SELECT pt.responsavel_id AS auth_id, COUNT(*)::int AS qtd
    FROM pipeline_tarefas pt
    WHERE pt.responsavel_id = ANY(v_team_auth)
      AND pt.status = 'pendente'
      AND (
        pt.vence_em < v_today
        OR (pt.vence_em = v_today
            AND COALESCE(pt.hora_vencimento, '23:59'::time)
                < (v_now AT TIME ZONE 'America/Sao_Paulo')::time)
      )
    GROUP BY pt.responsavel_id
  ),
  leads_sem_acao AS (
    SELECT pl.corretor_id AS auth_id, COUNT(*)::int AS qtd
    FROM pipeline_leads pl
    WHERE pl.corretor_id = ANY(v_team_auth)
      AND COALESCE(pl.arquivado, false) = false
      AND COALESCE(pl.ultima_acao_at, pl.primeiro_contato_em, pl.aceito_em, pl.created_at)
          < (v_now - INTERVAL '30 days')
    GROUP BY pl.corretor_id
  ),
  alertas_raw AS (
    SELECT
      tm.user_id AS auth_id,
      p.id       AS profile_id,
      p.nome,
      p.avatar_url,
      COALESCE(ta.qtd, 0) AS tarefas_atrasadas,
      COALESCE(ls.qtd, 0) AS leads_sem_acao_30d,
      COALESCE(ta.qtd, 0) + COALESCE(ls.qtd, 0) AS score_soma
    FROM (SELECT user_id FROM public.resolve_managed_brokers(p_gestor_id)) tm
    LEFT JOIN profiles p ON p.user_id = tm.user_id
    LEFT JOIN tarefas_atr ta ON ta.auth_id = tm.user_id
    LEFT JOIN leads_sem_acao ls ON ls.auth_id = tm.user_id
    WHERE true
  ),
  alertas_filtrados AS (
    SELECT * FROM alertas_raw
    ORDER BY score_soma DESC, nome ASC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'kpis_top', jsonb_build_object(
      'leads_recebidos',          (SELECT qtd FROM leads_atual),
      'leads_recebidos_anterior', (SELECT qtd FROM leads_prev),
      'leads_meta',               v_meta.meta_leads,
      'leads_delta_pct',          CASE WHEN (SELECT qtd FROM leads_prev) = 0 THEN NULL
                                       ELSE ROUND((((SELECT qtd FROM leads_atual)::numeric
                                                     - (SELECT qtd FROM leads_prev))
                                                    / (SELECT qtd FROM leads_prev)) * 100, 1) END,
      'visitas_realizadas',       (SELECT qtd FROM visitas_atual),
      'visitas_agendadas',        (SELECT qtd FROM visitas_agendadas),
      'visitas_total',            (SELECT qtd FROM visitas_total),
      'visitas_meta',             v_meta.meta_visitas_realizadas,
      'visitas_delta_pct',        CASE WHEN (SELECT qtd FROM visitas_prev) = 0 THEN NULL
                                       ELSE ROUND((((SELECT qtd FROM visitas_atual)::numeric
                                                     - (SELECT qtd FROM visitas_prev))
                                                    / (SELECT qtd FROM visitas_prev)) * 100, 1) END,
      'negocios_ativos',          (SELECT qtd FROM negocios_ativos_total),
      'negocios_meta',            v_meta.meta_negocios,
      'vendas_vgv',               (SELECT v FROM vendas_atual),
      'vendas_count',             (SELECT qtd FROM vendas_atual),
      'vendas_meta_vgv',          v_meta.meta_vgv_assinado,
      'vendas_delta_pct',         CASE WHEN (SELECT v FROM vendas_prev) = 0 THEN NULL
                                       ELSE ROUND((((SELECT v FROM vendas_atual)
                                                     - (SELECT v FROM vendas_prev))
                                                    / (SELECT v FROM vendas_prev)) * 100, 1) END,
      'periodo', p_periodo,
      'p_start', v_p_start,
      'p_end',   v_p_end
    ),
    'alertas_corretores', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'corretor_id',         a.profile_id,
        'auth_id',             a.auth_id,
        'nome',                a.nome,
        'avatar_url',          a.avatar_url,
        'tarefas_atrasadas',   a.tarefas_atrasadas,
        'leads_sem_acao_30d',  a.leads_sem_acao_30d,
        'score_soma',          a.score_soma,
        'severity',            CASE
                                 WHEN a.score_soma >= 70 THEN 'critico'
                                 WHEN a.score_soma >= 40 THEN 'atencao'
                                 ELSE 'ok'
                               END
      ) ORDER BY a.score_soma DESC, a.nome ASC)
       FROM alertas_filtrados a),
      '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;