CREATE OR REPLACE FUNCTION public.get_pipeline_equipes_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_now_t time := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
  v_mes text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
  v_month_start date := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_excl text[] := ARRAY['descarte','convertido','venda','contrato_gerado'];
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH team AS (
    SELECT tm.user_id AS corretor_auth, tm.gerente_id
    FROM public.team_members tm
    WHERE tm.status = 'ativo' AND tm.user_id IS NOT NULL AND tm.gerente_id IS NOT NULL
  ),
  leads_ativos AS (
    SELECT pl.id, pl.corretor_id AS corretor_auth, pl.ultima_acao_at
    FROM public.pipeline_leads pl
    JOIN team t ON t.corretor_auth = pl.corretor_id
    JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
    WHERE pl.arquivado = false
      AND pl.negocio_id IS NULL
      AND (ps.tipo IS NULL OR NOT (ps.tipo = ANY(v_excl)))
  ),
  tarefas AS (
    SELECT la.id AS lead_id, la.corretor_auth,
      bool_or(
        pt.vence_em < v_today
        OR (pt.vence_em = v_today AND pt.hora_vencimento IS NOT NULL AND pt.hora_vencimento < v_now_t)
      ) AS overdue
    FROM leads_ativos la
    LEFT JOIN public.pipeline_tarefas pt ON pt.pipeline_lead_id = la.id AND pt.status = 'pendente'
    GROUP BY la.id, la.corretor_auth
  ),
  agg_corretor AS (
    SELECT t.corretor_auth, t.gerente_id,
      count(tk.lead_id)::int AS leads_ativos,
      count(*) FILTER (WHERE tk.overdue)::int AS atrasados
    FROM team t
    LEFT JOIN tarefas tk ON tk.corretor_auth = t.corretor_auth
    GROUP BY t.corretor_auth, t.gerente_id
  ),
  ult_atividade AS (
    SELECT la.corretor_auth, max(la.ultima_acao_at) AS ultima_atividade
    FROM leads_ativos la
    GROUP BY la.corretor_auth
  ),
  neg_corretor AS (
    SELECT t.corretor_auth, t.gerente_id,
      count(n.id) FILTER (WHERE n.status = 'ativo')::int AS negocios,
      COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado)) FILTER (WHERE n.status = 'ativo'), 0)::numeric AS vgv_pipeline_ativo,
      COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado)) FILTER (
        WHERE n.fase = 'vendido'
          AND n.data_assinatura IS NOT NULL AND n.data_assinatura >= v_month_start
      ), 0)::numeric AS vgv_assinado_mes
    FROM team t
    LEFT JOIN public.negocios n ON n.auth_user_id = t.corretor_auth
    GROUP BY t.corretor_auth, t.gerente_id
  ),
  corretor_row AS (
    SELECT ac.gerente_id, ac.corretor_auth,
      p.id AS profile_id, p.nome,
      COALESCE(ac.leads_ativos, 0) AS leads_ativos,
      COALESCE(ac.atrasados, 0) AS atrasados,
      COALESCE(nc.negocios, 0) AS negocios,
      COALESCE(nc.vgv_pipeline_ativo, 0) AS vgv_pipeline_ativo,
      COALESCE(nc.vgv_assinado_mes, 0) AS vgv_assinado_mes,
      ua.ultima_atividade
    FROM agg_corretor ac
    LEFT JOIN neg_corretor nc ON nc.corretor_auth = ac.corretor_auth
    LEFT JOIN ult_atividade ua ON ua.corretor_auth = ac.corretor_auth
    LEFT JOIN public.profiles p ON p.user_id = ac.corretor_auth
  ),
  gestor_row AS (
    SELECT cr.gerente_id,
      gp.id AS profile_id,
      gp.nome AS gestor_nome,
      COALESCE(gp.avatar_gamificado_url, gp.avatar_url) AS avatar_url,
      count(*)::int AS qtd_corretores,
      COALESCE(sum(cr.leads_ativos), 0)::int AS total_leads,
      COALESCE(sum(cr.atrasados), 0)::int AS atrasados,
      COALESCE(sum(cr.negocios), 0)::int AS negocios,
      COALESCE(sum(cr.vgv_pipeline_ativo), 0)::numeric AS vgv_pipeline_ativo,
      COALESCE(sum(cr.vgv_assinado_mes), 0)::numeric AS vgv_assinado_mes,
      m.meta_vgv_assinado AS meta_vgv,
      jsonb_agg(jsonb_build_object(
        'auth_id', cr.corretor_auth,
        'profile_id', cr.profile_id,
        'nome', cr.nome,
        'leads_ativos', cr.leads_ativos,
        'atrasados', cr.atrasados,
        'negocios', cr.negocios,
        'ultima_atividade', cr.ultima_atividade
      ) ORDER BY cr.leads_ativos DESC) AS corretores
    FROM corretor_row cr
    LEFT JOIN public.profiles gp ON gp.user_id = cr.gerente_id
    LEFT JOIN public.ceo_metas_mensais m ON m.gerente_id = cr.gerente_id AND m.mes = v_mes
    GROUP BY cr.gerente_id, gp.id, gp.nome, gp.avatar_url, gp.avatar_gamificado_url, m.meta_vgv_assinado
  )
  SELECT jsonb_build_object(
    'escritorio', jsonb_build_object(
      'total_leads_ativos', COALESCE(sum(total_leads), 0),
      'atrasados',          COALESCE(sum(atrasados), 0),
      'negocios',           COALESCE(sum(negocios), 0),
      'vgv_assinado_mes',   COALESCE(sum(vgv_assinado_mes), 0),
      'vgv_pipeline_ativo', COALESCE(sum(vgv_pipeline_ativo), 0)
    ),
    'gestores', COALESCE(jsonb_agg(jsonb_build_object(
      'auth_id', gerente_id,
      'profile_id', profile_id,
      'nome', gestor_nome,
      'avatar_url', avatar_url,
      'qtd_corretores', qtd_corretores,
      'total_leads', total_leads,
      'atrasados', atrasados,
      'negocios', negocios,
      'vgv_assinado_mes', vgv_assinado_mes,
      'vgv_pipeline_ativo', vgv_pipeline_ativo,
      'meta_vgv', meta_vgv,
      'meta_pct', CASE
        WHEN meta_vgv IS NULL OR meta_vgv = 0 THEN NULL
        ELSE round(vgv_assinado_mes / meta_vgv * 100)
      END,
      'corretores', corretores
    ) ORDER BY total_leads DESC), '[]'::jsonb)
  ) INTO v_result
  FROM gestor_row;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pipeline_equipes_overview() TO authenticated;