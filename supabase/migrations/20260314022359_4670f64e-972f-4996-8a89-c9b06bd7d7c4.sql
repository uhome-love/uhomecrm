
-- ================================================================
-- OFFICIAL METRICS LAYER — Canonical Identity: auth.users.id
-- All views resolve to auth_user_id for consistent cross-module joins
-- ================================================================

-- 1. v_kpi_ligacoes: One row per call attempt
CREATE OR REPLACE VIEW public.v_kpi_ligacoes AS
SELECT
  oa.corretor_id AS auth_user_id,
  oa.created_at::date AS data,
  oa.canal,
  oa.resultado,
  CASE WHEN oa.resultado = 'com_interesse' THEN 1 ELSE 0 END AS aproveitado,
  CASE WHEN oa.resultado = 'atendeu' OR oa.resultado = 'com_interesse' THEN 1 ELSE 0 END AS atendeu,
  1 AS tentativa
FROM public.oferta_ativa_tentativas oa;

-- 2. v_kpi_visitas: One row per visit with canonical identity
CREATE OR REPLACE VIEW public.v_kpi_visitas AS
SELECT
  v.corretor_id AS auth_user_id,
  v.id,
  v.created_at::date AS data_criacao,
  v.data_visita::date AS data_visita,
  v.status,
  v.empreendimento,
  v.origem,
  CASE WHEN v.status IN ('marcada','confirmada','realizada','reagendada') THEN 1 ELSE 0 END AS conta_marcada,
  CASE WHEN v.status = 'realizada' THEN 1 ELSE 0 END AS conta_realizada,
  CASE WHEN v.status = 'no_show' THEN 1 ELSE 0 END AS conta_no_show
FROM public.visitas v;

-- 3. v_kpi_negocios: Deals with canonical identity (resolves profiles.id → auth.user_id)
CREATE OR REPLACE VIEW public.v_kpi_negocios AS
SELECT
  COALESCE(n.auth_user_id, p.user_id) AS auth_user_id,
  n.id,
  n.created_at::date AS data_criacao,
  n.data_assinatura::date AS data_assinatura,
  n.fase,
  n.empreendimento,
  n.vgv_estimado,
  n.vgv_final,
  COALESCE(n.vgv_final, n.vgv_estimado) AS vgv_efetivo,
  n.pipeline_lead_id,
  n.corretor_id AS profile_id,
  CASE WHEN n.fase IN ('proposta','negociacao','documentacao') THEN 1 ELSE 0 END AS conta_proposta,
  CASE WHEN n.fase IN ('assinado','vendido') THEN 1 ELSE 0 END AS conta_venda,
  CASE WHEN n.fase IN ('perdido','cancelado','distrato') THEN 1 ELSE 0 END AS conta_perdido
FROM public.negocios n
LEFT JOIN public.profiles p ON p.id = n.corretor_id;

-- 4. v_kpi_gestao_leads: Pipeline progression points
CREATE OR REPLACE VIEW public.v_kpi_gestao_leads AS
SELECT
  pl.corretor_id AS auth_user_id,
  ph.created_at::date AS data,
  ph.id AS historico_id,
  ph.pipeline_lead_id,
  ps.nome AS stage_nome,
  ps.ordem AS stage_ordem,
  CASE
    WHEN LOWER(ps.nome) LIKE '%contato%' THEN 5
    WHEN LOWER(ps.nome) LIKE '%qualifica%' THEN 10
    WHEN LOWER(ps.nome) LIKE '%v.marcada%' OR LOWER(ps.nome) LIKE '%visita marcada%' THEN 30
    WHEN LOWER(ps.nome) LIKE '%v.realizada%' OR LOWER(ps.nome) LIKE '%visita realizada%' THEN 50
    ELSE 0
  END AS pontos
FROM public.pipeline_historico ph
JOIN public.pipeline_leads pl ON pl.id = ph.pipeline_lead_id
JOIN public.pipeline_stages ps ON ps.id = ph.stage_novo_id;

-- 5. v_kpi_presenca: Presence from checkpoint_lines (resolves team_members.id → auth.user_id)
CREATE OR REPLACE VIEW public.v_kpi_presenca AS
SELECT
  tm.user_id AS auth_user_id,
  cp.data::date AS data,
  cl.real_presenca,
  CASE 
    WHEN cl.real_presenca IN ('presente','home_office','externo') THEN 1 
    ELSE 0 
  END AS presente,
  cl.real_ligacoes,
  cl.real_visitas_marcadas,
  cl.real_visitas_realizadas,
  cl.real_propostas,
  cl.real_vgv_assinado,
  cl.obs_dia,
  cl.obs_gerente
FROM public.checkpoint_lines cl
JOIN public.team_members tm ON tm.id = cl.corretor_id
JOIN public.checkpoints cp ON cp.id = cl.checkpoint_id
WHERE tm.user_id IS NOT NULL;

-- 6. v_kpi_disponibilidade: Real-time availability
CREATE OR REPLACE VIEW public.v_kpi_disponibilidade AS
SELECT
  cd.user_id AS auth_user_id,
  cd.status,
  cd.na_roleta,
  cd.segmentos,
  cd.entrada_em,
  cd.saida_em,
  cd.leads_recebidos_turno,
  CASE 
    WHEN cd.status IN ('online','na_empresa','disponivel','em_pausa','em_visita') THEN true
    ELSE false
  END AS esta_disponivel
FROM public.corretor_disponibilidade cd;

-- ================================================================
-- AGGREGATION FUNCTION: Get all KPIs for a date range
-- Returns one row per auth_user_id with all metric totals
-- Used by Rankings, Dashboards, Reports
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_kpis_por_periodo(
  p_start DATE,
  p_end DATE,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  auth_user_id UUID,
  total_ligacoes BIGINT,
  total_aproveitados BIGINT,
  taxa_aproveitamento NUMERIC,
  visitas_marcadas BIGINT,
  visitas_realizadas BIGINT,
  visitas_no_show BIGINT,
  propostas BIGINT,
  vendas BIGINT,
  vgv_gerado NUMERIC,
  vgv_assinado NUMERIC,
  pontos_gestao BIGINT,
  dias_presente BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lig AS (
    SELECT
      l.auth_user_id,
      COUNT(*) AS total_ligacoes,
      SUM(l.aproveitado) AS total_aproveitados
    FROM v_kpi_ligacoes l
    WHERE l.data BETWEEN p_start AND p_end
      AND (p_user_id IS NULL OR l.auth_user_id = p_user_id)
    GROUP BY l.auth_user_id
  ),
  vis AS (
    SELECT
      v.auth_user_id,
      SUM(v.conta_marcada) AS visitas_marcadas,
      SUM(CASE WHEN v.data_visita BETWEEN p_start AND p_end THEN v.conta_realizada ELSE 0 END) AS visitas_realizadas,
      SUM(CASE WHEN v.data_visita BETWEEN p_start AND p_end THEN v.conta_no_show ELSE 0 END) AS visitas_no_show
    FROM v_kpi_visitas v
    WHERE v.data_criacao BETWEEN p_start AND p_end
      AND (p_user_id IS NULL OR v.auth_user_id = p_user_id)
    GROUP BY v.auth_user_id
  ),
  vis_real AS (
    -- Visitas realizadas counted by data_visita (not created_at)
    SELECT
      v.auth_user_id,
      SUM(v.conta_realizada) AS visitas_realizadas_by_date,
      SUM(v.conta_no_show) AS visitas_no_show_by_date
    FROM v_kpi_visitas v
    WHERE v.data_visita BETWEEN p_start AND p_end
      AND (p_user_id IS NULL OR v.auth_user_id = p_user_id)
    GROUP BY v.auth_user_id
  ),
  neg AS (
    SELECT
      n.auth_user_id,
      SUM(n.conta_proposta) AS propostas,
      SUM(n.conta_venda) AS vendas,
      SUM(CASE WHEN n.conta_proposta = 1 OR n.conta_venda = 1 THEN COALESCE(n.vgv_estimado, 0) ELSE 0 END) AS vgv_gerado,
      SUM(CASE WHEN n.conta_venda = 1 AND n.data_assinatura BETWEEN p_start AND p_end THEN COALESCE(n.vgv_efetivo, 0) ELSE 0 END) AS vgv_assinado
    FROM v_kpi_negocios n
    WHERE n.data_criacao BETWEEN p_start AND p_end
      AND (p_user_id IS NULL OR n.auth_user_id = p_user_id)
    GROUP BY n.auth_user_id
  ),
  neg_assinado AS (
    -- VGV assinado by data_assinatura (not created_at)
    SELECT
      n.auth_user_id,
      SUM(COALESCE(n.vgv_efetivo, 0)) AS vgv_assinado_by_date
    FROM v_kpi_negocios n
    WHERE n.data_assinatura BETWEEN p_start AND p_end
      AND n.conta_venda = 1
      AND (p_user_id IS NULL OR n.auth_user_id = p_user_id)
    GROUP BY n.auth_user_id
  ),
  gest AS (
    SELECT
      g.auth_user_id,
      SUM(g.pontos) AS pontos_gestao
    FROM v_kpi_gestao_leads g
    WHERE g.data BETWEEN p_start AND p_end
      AND (p_user_id IS NULL OR g.auth_user_id = p_user_id)
    GROUP BY g.auth_user_id
  ),
  pres AS (
    SELECT
      pr.auth_user_id,
      SUM(pr.presente) AS dias_presente
    FROM v_kpi_presenca pr
    WHERE pr.data BETWEEN p_start AND p_end
      AND (p_user_id IS NULL OR pr.auth_user_id = p_user_id)
    GROUP BY pr.auth_user_id
  ),
  all_users AS (
    SELECT user_id AS auth_user_id FROM profiles WHERE user_id IS NOT NULL
      AND (p_user_id IS NULL OR user_id = p_user_id)
  )
  SELECT
    u.auth_user_id,
    COALESCE(lig.total_ligacoes, 0),
    COALESCE(lig.total_aproveitados, 0),
    CASE WHEN COALESCE(lig.total_ligacoes, 0) > 0 
      THEN ROUND((COALESCE(lig.total_aproveitados, 0)::numeric / lig.total_ligacoes) * 100, 1)
      ELSE 0 
    END AS taxa_aproveitamento,
    COALESCE(vis.visitas_marcadas, 0),
    COALESCE(vis_real.visitas_realizadas_by_date, 0),
    COALESCE(vis_real.visitas_no_show_by_date, 0),
    COALESCE(neg.propostas, 0),
    COALESCE(neg.vendas, COALESCE(neg_assinado.vgv_assinado_by_date, 0)::bigint / NULLIF(1,0)),
    COALESCE(neg.vgv_gerado, 0),
    COALESCE(neg_assinado.vgv_assinado_by_date, 0),
    COALESCE(gest.pontos_gestao, 0),
    COALESCE(pres.dias_presente, 0)
  FROM all_users u
  LEFT JOIN lig ON lig.auth_user_id = u.auth_user_id
  LEFT JOIN vis ON vis.auth_user_id = u.auth_user_id
  LEFT JOIN vis_real ON vis_real.auth_user_id = u.auth_user_id
  LEFT JOIN neg ON neg.auth_user_id = u.auth_user_id
  LEFT JOIN neg_assinado ON neg_assinado.auth_user_id = u.auth_user_id
  LEFT JOIN gest ON gest.auth_user_id = u.auth_user_id
  LEFT JOIN pres ON pres.auth_user_id = u.auth_user_id
  WHERE COALESCE(lig.total_ligacoes, 0) > 0
     OR COALESCE(vis.visitas_marcadas, 0) > 0
     OR COALESCE(neg.propostas, 0) > 0
     OR COALESCE(neg.vendas, 0) > 0
     OR COALESCE(gest.pontos_gestao, 0) > 0
     OR COALESCE(pres.dias_presente, 0) > 0
     OR COALESCE(neg_assinado.vgv_assinado_by_date, 0) > 0;
$$;

-- Grant access
GRANT SELECT ON public.v_kpi_ligacoes TO authenticated;
GRANT SELECT ON public.v_kpi_visitas TO authenticated;
GRANT SELECT ON public.v_kpi_negocios TO authenticated;
GRANT SELECT ON public.v_kpi_gestao_leads TO authenticated;
GRANT SELECT ON public.v_kpi_presenca TO authenticated;
GRANT SELECT ON public.v_kpi_disponibilidade TO authenticated;
