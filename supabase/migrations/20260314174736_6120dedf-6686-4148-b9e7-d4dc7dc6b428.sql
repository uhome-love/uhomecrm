-- =====================================================
-- Performance: eliminate ::date cast bottleneck in KPI views
--
-- Strategy: DROP and recreate both views with a new raw_created_at
-- column (timestamptz), keeping "data" as-is for backward compat.
-- Then update the RPC to filter on raw_created_at with range comparisons.
-- =====================================================

-- Must drop dependent function first
DROP FUNCTION IF EXISTS public.get_kpis_por_periodo(date, date, uuid);

-- 1. v_kpi_ligacoes: add raw_created_at passthrough
DROP VIEW IF EXISTS public.v_kpi_ligacoes;
CREATE VIEW public.v_kpi_ligacoes AS
SELECT
  oa.corretor_id AS auth_user_id,
  oa.created_at::date AS data,
  oa.created_at AS raw_created_at,
  oa.canal,
  oa.resultado,
  CASE WHEN oa.resultado = 'com_interesse' THEN 1 ELSE 0 END AS aproveitado,
  CASE WHEN oa.resultado = 'atendeu' OR oa.resultado = 'com_interesse' THEN 1 ELSE 0 END AS atendeu,
  1 AS tentativa
FROM public.oferta_ativa_tentativas oa;

ALTER VIEW public.v_kpi_ligacoes SET (security_invoker = true);
GRANT SELECT ON public.v_kpi_ligacoes TO authenticated;

-- 2. v_kpi_gestao_leads: add raw_created_at passthrough
DROP VIEW IF EXISTS public.v_kpi_gestao_leads;
CREATE VIEW public.v_kpi_gestao_leads AS
SELECT
  pl.corretor_id AS auth_user_id,
  ph.created_at::date AS data,
  ph.created_at AS raw_created_at,
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

ALTER VIEW public.v_kpi_gestao_leads SET (security_invoker = true);
GRANT SELECT ON public.v_kpi_gestao_leads TO authenticated;

-- 3. Recreate get_kpis_por_periodo with timestamptz range filters on lig + gest CTEs
CREATE FUNCTION public.get_kpis_por_periodo(p_start date, p_end date, p_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  auth_user_id uuid,
  total_ligacoes bigint,
  total_aproveitados bigint,
  taxa_aproveitamento numeric,
  visitas_marcadas bigint,
  visitas_realizadas bigint,
  visitas_no_show bigint,
  propostas bigint,
  vendas bigint,
  vgv_gerado numeric,
  vgv_assinado numeric,
  pontos_gestao bigint,
  dias_presente bigint,
  perdidos bigint,
  perdidos_unicos bigint
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH lig AS (
    SELECT l.auth_user_id, COUNT(*) AS total_ligacoes, SUM(l.aproveitado) AS total_aproveitados
    FROM v_kpi_ligacoes l
    WHERE l.raw_created_at >= p_start::timestamptz
      AND l.raw_created_at < (p_end + 1)::timestamptz
      AND (p_user_id IS NULL OR l.auth_user_id = p_user_id)
    GROUP BY l.auth_user_id
  ),
  vis AS (
    SELECT v.auth_user_id, SUM(v.conta_marcada) AS visitas_marcadas,
      SUM(CASE WHEN v.data_visita BETWEEN p_start AND p_end THEN v.conta_realizada ELSE 0 END) AS visitas_realizadas,
      SUM(CASE WHEN v.data_visita BETWEEN p_start AND p_end THEN v.conta_no_show ELSE 0 END) AS visitas_no_show
    FROM v_kpi_visitas v
    WHERE v.data_criacao BETWEEN p_start AND p_end AND (p_user_id IS NULL OR v.auth_user_id = p_user_id)
    GROUP BY v.auth_user_id
  ),
  vis_real AS (
    SELECT v.auth_user_id, SUM(v.conta_realizada) AS visitas_realizadas_by_date, SUM(v.conta_no_show) AS visitas_no_show_by_date
    FROM v_kpi_visitas v
    WHERE v.data_visita BETWEEN p_start AND p_end AND (p_user_id IS NULL OR v.auth_user_id = p_user_id)
    GROUP BY v.auth_user_id
  ),
  neg AS (
    SELECT n.auth_user_id,
      SUM(n.conta_proposta) AS propostas,
      SUM(n.conta_venda) AS vendas,
      SUM(n.conta_perdido) AS perdidos,
      COUNT(DISTINCT CASE WHEN n.conta_perdido = 1 THEN n.id END) AS perdidos_unicos,
      SUM(CASE WHEN n.conta_proposta = 1 OR n.conta_venda = 1 THEN COALESCE(n.vgv_estimado, 0) ELSE 0 END) AS vgv_gerado,
      SUM(CASE WHEN n.conta_venda = 1 AND n.data_assinatura BETWEEN p_start AND p_end THEN COALESCE(n.vgv_efetivo, 0) ELSE 0 END) AS vgv_assinado
    FROM v_kpi_negocios n
    WHERE n.data_criacao BETWEEN p_start AND p_end AND (p_user_id IS NULL OR n.auth_user_id = p_user_id)
    GROUP BY n.auth_user_id
  ),
  neg_assinado AS (
    SELECT n.auth_user_id, SUM(COALESCE(n.vgv_efetivo, 0)) AS vgv_assinado_by_date
    FROM v_kpi_negocios n
    WHERE n.data_assinatura BETWEEN p_start AND p_end AND n.conta_venda = 1 AND (p_user_id IS NULL OR n.auth_user_id = p_user_id)
    GROUP BY n.auth_user_id
  ),
  gest AS (
    SELECT g.auth_user_id, SUM(g.pontos) AS pontos_gestao
    FROM v_kpi_gestao_leads g
    WHERE g.raw_created_at >= p_start::timestamptz
      AND g.raw_created_at < (p_end + 1)::timestamptz
      AND (p_user_id IS NULL OR g.auth_user_id = p_user_id)
    GROUP BY g.auth_user_id
  ),
  pres AS (
    SELECT pr.auth_user_id, SUM(pr.presente) AS dias_presente
    FROM v_kpi_presenca pr
    WHERE pr.data BETWEEN p_start AND p_end AND (p_user_id IS NULL OR pr.auth_user_id = p_user_id)
    GROUP BY pr.auth_user_id
  ),
  all_users AS (
    SELECT user_id AS auth_user_id FROM profiles WHERE user_id IS NOT NULL AND (p_user_id IS NULL OR user_id = p_user_id)
  )
  SELECT
    u.auth_user_id,
    COALESCE(lig.total_ligacoes, 0),
    COALESCE(lig.total_aproveitados, 0),
    CASE WHEN COALESCE(lig.total_ligacoes, 0) > 0
      THEN ROUND((COALESCE(lig.total_aproveitados, 0)::numeric / lig.total_ligacoes) * 100, 1) ELSE 0
    END AS taxa_aproveitamento,
    COALESCE(vis.visitas_marcadas, 0),
    COALESCE(vis_real.visitas_realizadas_by_date, 0),
    COALESCE(vis_real.visitas_no_show_by_date, 0),
    COALESCE(neg.propostas, 0),
    COALESCE(neg.vendas, 0),
    COALESCE(neg.vgv_gerado, 0),
    COALESCE(neg_assinado.vgv_assinado_by_date, 0),
    COALESCE(gest.pontos_gestao, 0),
    COALESCE(pres.dias_presente, 0),
    COALESCE(neg.perdidos, 0),
    COALESCE(neg.perdidos_unicos, 0)
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
     OR COALESCE(neg.perdidos, 0) > 0
     OR COALESCE(gest.pontos_gestao, 0) > 0
     OR COALESCE(pres.dias_presente, 0) > 0
     OR COALESCE(neg_assinado.vgv_assinado_by_date, 0) > 0;
$$;