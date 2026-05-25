CREATE OR REPLACE FUNCTION public.get_dashboard_gerente(p_gestor_id uuid, p_periodo text DEFAULT 'mes'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_today date := (v_now)::date;
  v_p_start date;
  v_p_end   date;
  v_prev_start date;
  v_prev_end   date;
  v_mes_key text;
  v_meta record;
  v_kpis jsonb;
  v_corretores jsonb;
  v_team uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF auth.uid() <> p_gestor_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_periodo = 'hoje' THEN
    v_p_start := v_today; v_p_end := v_today;
    v_prev_start := v_today - INTERVAL '7 days'; v_prev_end := v_today - INTERVAL '7 days';
  ELSIF p_periodo = 'semana' THEN
    v_p_start := date_trunc('week', v_today)::date;
    v_p_end := (date_trunc('week', v_today) + INTERVAL '6 days')::date;
    v_prev_start := (date_trunc('week', v_today) - INTERVAL '7 days')::date;
    v_prev_end := (date_trunc('week', v_today) - INTERVAL '1 day')::date;
  ELSE
    v_p_start := date_trunc('month', v_today)::date;
    v_p_end := (date_trunc('month', v_today) + INTERVAL '1 month - 1 day')::date;
    v_prev_start := (date_trunc('month', v_today) - INTERVAL '1 month')::date;
    v_prev_end := (date_trunc('month', v_today) - INTERVAL '1 day')::date;
  END IF;

  v_mes_key := to_char(v_today, 'YYYY-MM');

  SELECT array_agg(user_id) INTO v_team
  FROM team_members WHERE gerente_id = p_gestor_id AND status = 'ativo';
  IF v_team IS NULL THEN v_team := ARRAY[]::uuid[]; END IF;

  SELECT * INTO v_meta FROM ceo_metas_mensais
  WHERE gerente_id = p_gestor_id AND mes = v_mes_key LIMIT 1;
  IF v_meta IS NULL THEN
    v_meta.meta_vgv_assinado := 0;
    v_meta.meta_leads := 400;
    v_meta.meta_visitas_realizadas := 0;
    v_meta.meta_negocios := 90;
  END IF;

  WITH
  prof AS (SELECT id AS profile_id, user_id AS auth_id FROM profiles WHERE user_id = ANY(v_team)),
  vendas_atual AS (
    SELECT COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)), 0)::numeric AS v, COUNT(*)::int AS qtd
    FROM negocios n JOIN prof p ON p.profile_id = n.corretor_id
    WHERE n.data_assinatura BETWEEN v_p_start AND v_p_end
  ),
  vendas_prev AS (
    SELECT COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)), 0)::numeric AS v, COUNT(*)::int AS qtd
    FROM negocios n JOIN prof p ON p.profile_id = n.corretor_id
    WHERE n.data_assinatura BETWEEN v_prev_start AND v_prev_end
  ),
  leads_atual AS (
    SELECT COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_p_start AND v_p_end
  ),
  leads_prev AS (
    SELECT COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_prev_start AND v_prev_end
  ),
  visitas_atual AS (
    SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team) AND data_visita BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead')
  ),
  visitas_prev AS (
    SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team) AND data_visita BETWEEN v_prev_start AND v_prev_end
      AND (tipo IS NULL OR tipo = 'lead')
  ),
  negocios_ativos_total AS (
    SELECT COUNT(*)::int AS qtd FROM negocios n
    JOIN prof p ON p.profile_id = n.corretor_id
    WHERE n.status = 'ativo'
  )
  SELECT jsonb_build_object(
    'vendas',         (SELECT v FROM vendas_atual),
    'vendas_qtd',     (SELECT qtd FROM vendas_atual),
    'meta_vendas',    v_meta.meta_vgv_assinado,
    'leads',          (SELECT qtd FROM leads_atual),
    'meta_leads',     v_meta.meta_leads,
    'visitas',        (SELECT qtd FROM visitas_atual),
    'meta_visitas',   v_meta.meta_visitas_realizadas,
    'negocios',       (SELECT qtd FROM negocios_ativos_total),
    'meta_negocios',  v_meta.meta_negocios,
    'delta_vendas',   CASE WHEN (SELECT v FROM vendas_prev) = 0 THEN NULL
                           ELSE ROUND((((SELECT v FROM vendas_atual) - (SELECT v FROM vendas_prev)) / (SELECT v FROM vendas_prev)) * 100, 1) END,
    'delta_leads',    CASE WHEN (SELECT qtd FROM leads_prev) = 0 THEN NULL
                           ELSE ROUND((((SELECT qtd FROM leads_atual)::numeric - (SELECT qtd FROM leads_prev)) / (SELECT qtd FROM leads_prev)) * 100, 1) END,
    'delta_visitas',  CASE WHEN (SELECT qtd FROM visitas_prev) = 0 THEN NULL
                           ELSE ROUND((((SELECT qtd FROM visitas_atual)::numeric - (SELECT qtd FROM visitas_prev)) / (SELECT qtd FROM visitas_prev)) * 100, 1) END,
    'delta_negocios', NULL,
    'periodo',        p_periodo,
    'p_start',        v_p_start,
    'p_end',          v_p_end
  ) INTO v_kpis;

  WITH prof AS (
    SELECT id AS profile_id, user_id AS auth_id, nome, avatar_url
    FROM profiles WHERE user_id = ANY(v_team)
  ),
  vendas_c AS (
    SELECT p.auth_id, COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)),0)::numeric AS vgv
    FROM prof p
    LEFT JOIN negocios n ON n.corretor_id = p.profile_id
     AND n.data_assinatura BETWEEN v_p_start AND v_p_end
    GROUP BY p.auth_id
  ),
  leads_recebidos AS (
    SELECT corretor_id, COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_p_start AND v_p_end
    GROUP BY corretor_id
  ),
  leads_ativos AS (
    SELECT corretor_id, COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team) AND COALESCE(arquivado, false) = false AND negocio_id IS NULL
    GROUP BY corretor_id
  ),
  leads_sem_acao AS (
    SELECT corretor_id, COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team) AND COALESCE(arquivado, false) = false AND negocio_id IS NULL
      AND COALESCE(ultima_acao_at, '1970-01-01'::timestamptz) < (now() - INTERVAL '30 days')
    GROUP BY corretor_id
  ),
  pipe_em_dia AS (
    SELECT corretor_id,
           COUNT(*) FILTER (WHERE COALESCE(ultima_acao_at, '1970-01-01'::timestamptz) >= (now() - INTERVAL '7 days'))::int AS em_dia,
           COUNT(*)::int AS total
    FROM pipeline_leads
    WHERE corretor_id = ANY(v_team) AND COALESCE(arquivado, false) = false AND negocio_id IS NULL
    GROUP BY corretor_id
  ),
  vis_marcadas AS (
    SELECT corretor_id, COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team) AND data_visita BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead') AND status IN ('marcada','confirmada','reagendada')
    GROUP BY corretor_id
  ),
  vis_realizadas AS (
    SELECT corretor_id, COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team) AND data_visita BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead') AND status = 'realizada'
    GROUP BY corretor_id
  ),
  negocios_ativos AS (
    SELECT p.auth_id, COUNT(*)::int AS qtd FROM prof p
    JOIN negocios n ON n.corretor_id = p.profile_id WHERE n.status = 'ativo'
    GROUP BY p.auth_id
  ),
  tarefas_atr AS (
    SELECT responsavel_id AS corretor_id, COUNT(*)::int AS qtd FROM pipeline_tarefas
    WHERE responsavel_id = ANY(v_team) AND status = 'pendente'
      AND (vence_em < v_today OR (vence_em = v_today AND COALESCE(hora_vencimento, '23:59:00'::time) < (v_now)::time))
    GROUP BY responsavel_id
  ),
  dias_alta AS (
    SELECT corretor_id, COUNT(DISTINCT d.dia)::int AS dias
    FROM (
      SELECT corretor_id, (ultima_acao_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia
      FROM pipeline_leads
      WHERE corretor_id = ANY(v_team) AND ultima_acao_at >= (now() - INTERVAL '14 days')
      UNION
      SELECT v.corretor_id, v.data_visita FROM visitas v
      WHERE v.corretor_id = ANY(v_team) AND v.data_visita >= (v_today - INTERVAL '14 days')::date
    ) d GROUP BY corretor_id
  ),
  base AS (
    SELECT p.auth_id AS user_id, p.nome, p.avatar_url,
      COALESCE(v.vgv, 0)::numeric AS vendas_vgv,
      COALESCE(lr.qtd, 0) AS leads_recebidos,
      COALESCE(la.qtd, 0) AS leads_ativos,
      COALESCE(lsa.qtd, 0) AS leads_sem_acao_30d,
      COALESCE(ped.em_dia, 0) AS pipe_em_dia,
      COALESCE(ped.total, 0) AS pipe_total,
      COALESCE(vm.qtd, 0) AS visitas_marcadas,
      COALESCE(vr.qtd, 0) AS visitas_realizadas,
      COALESCE(na.qtd, 0) AS negocios_ativos,
      COALESCE(na.qtd, 0) AS negocios,
      COALESCE(ta.qtd, 0) AS tarefas_atrasadas,
      COALESCE(da.dias, 0) AS dias_em_alta,
      COALESCE(lr.qtd, 0) AS leads_total
    FROM prof p
    LEFT JOIN vendas_c v        ON v.auth_id = p.auth_id
    LEFT JOIN leads_recebidos lr ON lr.corretor_id = p.auth_id
    LEFT JOIN leads_ativos la    ON la.corretor_id = p.auth_id
    LEFT JOIN leads_sem_acao lsa ON lsa.corretor_id = p.auth_id
    LEFT JOIN pipe_em_dia ped    ON ped.corretor_id = p.auth_id
    LEFT JOIN vis_marcadas vm    ON vm.corretor_id = p.auth_id
    LEFT JOIN vis_realizadas vr  ON vr.corretor_id = p.auth_id
    LEFT JOIN negocios_ativos na ON na.auth_id = p.auth_id
    LEFT JOIN tarefas_atr ta     ON ta.corretor_id = p.auth_id
    LEFT JOIN dias_alta da       ON da.corretor_id = p.auth_id
  ),
  stats AS (
    SELECT AVG(vendas_vgv) AS mu, COALESCE(NULLIF(STDDEV_POP(vendas_vgv),0), 1) AS sigma FROM base
  ),
  scored AS (
    SELECT b.*,
      CASE
        WHEN b.tarefas_atrasadas >= 25 THEN 'critico'
        WHEN b.dias_em_alta >= 3 THEN 'em_alta'
        WHEN (b.vendas_vgv - (SELECT mu FROM stats)) / (SELECT sigma FROM stats) >= 0.84 THEN 'top'
        WHEN (b.vendas_vgv - (SELECT mu FROM stats)) / (SELECT sigma FROM stats) <= -1.28 THEN 'atencao'
        ELSE 'ok'
      END AS status,
      CASE
        WHEN b.leads_sem_acao_30d >= 20 THEN b.leads_sem_acao_30d::text || ' leads sem ação há 30d+'
        WHEN b.tarefas_atrasadas >= 25 THEN b.tarefas_atrasadas::text || ' tarefas atrasadas'
        WHEN b.leads_ativos > GREATEST(b.leads_recebidos, 1) * 1.5 THEN 'Carteira sobrecarregada'
        WHEN b.dias_em_alta >= 5 THEN 'Em alta há ' || b.dias_em_alta::text || ' dias'
        ELSE NULL
      END AS meta_line
    FROM base b
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(scored) ORDER BY vendas_vgv DESC, negocios_ativos DESC), '[]'::jsonb)
    INTO v_corretores FROM scored;

  RETURN jsonb_build_object(
    'kpis_top',   v_kpis,
    'corretores', v_corretores,
    'meta_id',    (SELECT id FROM ceo_metas_mensais WHERE gerente_id = p_gestor_id AND mes = v_mes_key LIMIT 1),
    'mes_key',    v_mes_key
  );
END;
$function$;