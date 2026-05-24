-- get_time_agregado: agregado 1 linha por corretor do time do gestor
-- Fase 2.1 — Modo Time

CREATE OR REPLACE FUNCTION public.get_time_agregado(p_gestor_id uuid)
RETURNS TABLE (
  corretor_id uuid,
  nome text,
  avatar_url text,
  segmento_principal text,
  total_leads integer,
  sem_tarefa integer,
  atrasados integer,
  em_dia integer,
  para_hoje integer,
  sem_contato_5d integer,
  negocios integer,
  vgv_pipeline numeric,
  conversao_pct numeric,
  alerta_principal text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_brt date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_now_time_brt time := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
  v_excluded_stage_tipos text[] := ARRAY['descarte','convertido','venda','contrato_gerado'];
  v_touch_types text[] := ARRAY[
    'followup','whatsapp','ligacao','tarefa','contato',
    'nao_atendeu','mensagem','nota','proposta','reuniao','visita','email','retorno'
  ];
BEGIN
  -- Autorização: só o próprio gestor ou admin
  IF auth.uid() IS NULL OR (auth.uid() <> p_gestor_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  WITH team AS (
    SELECT tm.user_id AS corretor_auth_id
    FROM public.team_members tm
    WHERE tm.gerente_id = p_gestor_id
      AND tm.status = 'ativo'
      AND tm.user_id IS NOT NULL
  ),
  team_profile AS (
    SELECT
      t.corretor_auth_id,
      p.id AS profile_id,
      p.nome,
      COALESCE(p.avatar_gamificado_url, p.avatar_url) AS avatar_url
    FROM team t
    LEFT JOIN public.profiles p ON p.user_id = t.corretor_auth_id
  ),
  -- Leads ativos por corretor (excluindo descarte/convertido/venda/contrato_gerado e leads já em negócio)
  leads_ativos AS (
    SELECT
      pl.id,
      pl.corretor_id AS corretor_auth_id,
      pl.created_at,
      pl.ultima_acao_at
    FROM public.pipeline_leads pl
    JOIN team t ON t.corretor_auth_id = pl.corretor_id
    JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
    WHERE pl.arquivado = false
      AND pl.negocio_id IS NULL
      AND (ps.tipo IS NULL OR NOT (ps.tipo = ANY(v_excluded_stage_tipos)))
  ),
  -- Tarefas pendentes por lead com classificação
  tarefas_lead AS (
    SELECT
      la.id AS lead_id,
      la.corretor_auth_id,
      bool_or(
        pt.vence_em < v_today_brt
        OR (pt.vence_em = v_today_brt AND pt.hora_vencimento IS NOT NULL AND pt.hora_vencimento < v_now_time_brt)
      ) AS has_overdue,
      bool_or(
        pt.vence_em = v_today_brt
        AND (pt.hora_vencimento IS NULL OR pt.hora_vencimento >= v_now_time_brt)
      ) AS has_today,
      bool_or(pt.vence_em > v_today_brt OR pt.vence_em IS NULL) AS has_future,
      count(pt.id) AS pending_count
    FROM leads_ativos la
    LEFT JOIN public.pipeline_tarefas pt
      ON pt.pipeline_lead_id = la.id AND pt.status = 'pendente'
    GROUP BY la.id, la.corretor_auth_id
  ),
  -- Último toque real por lead (via pipeline_atividades)
  last_touch_lead AS (
    SELECT
      la.id AS lead_id,
      la.corretor_auth_id,
      MAX(pa.created_at) AS last_touch_at,
      la.created_at AS lead_created_at
    FROM leads_ativos la
    LEFT JOIN public.pipeline_atividades pa
      ON pa.pipeline_lead_id = la.id
     AND pa.tipo = ANY(v_touch_types)
    GROUP BY la.id, la.corretor_auth_id, la.created_at
  ),
  -- Agregados por corretor sobre leads ativos
  agg_leads AS (
    SELECT
      tl.corretor_auth_id,
      count(*)::int AS total_leads,
      count(*) FILTER (WHERE tl.pending_count = 0)::int AS sem_tarefa,
      count(*) FILTER (WHERE tl.has_overdue)::int AS atrasados,
      count(*) FILTER (WHERE NOT tl.has_overdue AND tl.has_today)::int AS para_hoje,
      count(*) FILTER (WHERE NOT tl.has_overdue AND NOT tl.has_today AND tl.has_future)::int AS em_dia
    FROM tarefas_lead tl
    GROUP BY tl.corretor_auth_id
  ),
  agg_sem_contato AS (
    SELECT
      lt.corretor_auth_id,
      count(*) FILTER (
        WHERE COALESCE(lt.last_touch_at, lt.lead_created_at) < (now() - INTERVAL '5 days')
      )::int AS sem_contato_5d
    FROM last_touch_lead lt
    GROUP BY lt.corretor_auth_id
  ),
  -- Negócios ativos por corretor (auth_user_id) + VGV no pipeline
  agg_negocios AS (
    SELECT
      tp.corretor_auth_id,
      count(n.id)::int AS negocios,
      COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado)), 0)::numeric AS vgv_pipeline
    FROM team_profile tp
    LEFT JOIN public.negocios n
      ON n.auth_user_id = tp.corretor_auth_id
     AND n.status = 'ativo'
    GROUP BY tp.corretor_auth_id
  ),
  -- Conversão últimos 90 dias
  conv_num AS (
    SELECT n.auth_user_id AS corretor_auth_id, count(*)::int AS assinados_90d
    FROM public.negocios n
    JOIN team t ON t.corretor_auth_id = n.auth_user_id
    WHERE n.data_assinatura IS NOT NULL
      AND n.data_assinatura >= (v_today_brt - INTERVAL '90 days')
    GROUP BY n.auth_user_id
  ),
  conv_den AS (
    SELECT pl.corretor_id AS corretor_auth_id, count(*)::int AS leads_90d
    FROM public.pipeline_leads pl
    JOIN team t ON t.corretor_auth_id = pl.corretor_id
    WHERE pl.created_at >= (now() - INTERVAL '90 days')
    GROUP BY pl.corretor_id
  )
  SELECT
    tp.corretor_auth_id AS corretor_id,
    COALESCE(tp.nome, '(sem nome)') AS nome,
    tp.avatar_url,
    NULL::text AS segmento_principal,
    COALESCE(al.total_leads, 0) AS total_leads,
    COALESCE(al.sem_tarefa, 0) AS sem_tarefa,
    COALESCE(al.atrasados, 0) AS atrasados,
    COALESCE(al.em_dia, 0) AS em_dia,
    COALESCE(al.para_hoje, 0) AS para_hoje,
    COALESCE(asc2.sem_contato_5d, 0) AS sem_contato_5d,
    COALESCE(an.negocios, 0) AS negocios,
    COALESCE(an.vgv_pipeline, 0) AS vgv_pipeline,
    CASE
      WHEN COALESCE(cd.leads_90d, 0) > 0
        THEN ROUND((COALESCE(cn.assinados_90d, 0)::numeric / cd.leads_90d::numeric) * 100, 1)
      ELSE NULL
    END AS conversao_pct,
    CASE
      WHEN COALESCE(al.atrasados, 0) >= 5
        THEN COALESCE(al.atrasados, 0) || ' tarefas atrasadas'
      WHEN COALESCE(asc2.sem_contato_5d, 0) >= 5
        THEN COALESCE(asc2.sem_contato_5d, 0) || ' leads sem contato há 5+ dias'
      WHEN COALESCE(al.sem_tarefa, 0) >= 10
        THEN COALESCE(al.sem_tarefa, 0) || ' leads sem próxima ação'
      ELSE NULL
    END AS alerta_principal
  FROM team_profile tp
  LEFT JOIN agg_leads al ON al.corretor_auth_id = tp.corretor_auth_id
  LEFT JOIN agg_sem_contato asc2 ON asc2.corretor_auth_id = tp.corretor_auth_id
  LEFT JOIN agg_negocios an ON an.corretor_auth_id = tp.corretor_auth_id
  LEFT JOIN conv_num cn ON cn.corretor_auth_id = tp.corretor_auth_id
  LEFT JOIN conv_den cd ON cd.corretor_auth_id = tp.corretor_auth_id
  ORDER BY tp.nome NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_time_agregado(uuid) TO authenticated;