
CREATE OR REPLACE FUNCTION public.get_kpis_por_periodo(p_start date, p_end date, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(auth_user_id uuid, total_ligacoes bigint, total_aproveitados bigint, taxa_aproveitamento numeric, visitas_marcadas bigint, visitas_realizadas bigint, visitas_no_show bigint, propostas bigint, vendas bigint, vgv_gerado numeric, vgv_assinado numeric, pontos_gestao bigint, dias_presente bigint, perdidos bigint, perdidos_unicos bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH lig AS (
    SELECT l.auth_user_id, COUNT(*) AS total_ligacoes, SUM(l.aproveitado) AS total_aproveitados
    FROM v_kpi_ligacoes l
    WHERE l.raw_created_at >= p_start::timestamptz
      AND l.raw_created_at < (p_end + 1)::timestamptz
      AND (p_user_id IS NULL OR l.auth_user_id = p_user_id)
    GROUP BY l.auth_user_id
  ),
  -- CONSOLIDATED: vis + vis_real merged into single scan of v_kpi_visitas
  vis AS (
    SELECT v.auth_user_id,
      SUM(CASE WHEN v.data_criacao BETWEEN p_start AND p_end THEN v.conta_marcada ELSE 0 END) AS visitas_marcadas,
      SUM(CASE WHEN v.data_visita BETWEEN p_start AND p_end THEN v.conta_realizada ELSE 0 END) AS visitas_realizadas,
      SUM(CASE WHEN v.data_visita BETWEEN p_start AND p_end THEN v.conta_no_show ELSE 0 END) AS visitas_no_show
    FROM v_kpi_visitas v
    WHERE (p_user_id IS NULL OR v.auth_user_id = p_user_id)
      AND (
        (v.data_criacao BETWEEN p_start AND p_end)
        OR (v.data_visita BETWEEN p_start AND p_end)
      )
    GROUP BY v.auth_user_id
  ),
  -- CONSOLIDATED: neg + neg_assinado merged into single scan of v_kpi_negocios
  neg AS (
    SELECT n.auth_user_id,
      SUM(CASE WHEN n.data_criacao BETWEEN p_start AND p_end THEN n.conta_proposta ELSE 0 END) AS propostas,
      SUM(CASE WHEN n.data_criacao BETWEEN p_start AND p_end THEN n.conta_venda ELSE 0 END) AS vendas,
      SUM(CASE WHEN n.data_criacao BETWEEN p_start AND p_end THEN n.conta_perdido ELSE 0 END) AS perdidos,
      COUNT(DISTINCT CASE WHEN n.data_criacao BETWEEN p_start AND p_end AND n.conta_perdido = 1 THEN n.id END) AS perdidos_unicos,
      SUM(CASE WHEN n.data_criacao BETWEEN p_start AND p_end AND (n.conta_proposta = 1 OR n.conta_venda = 1) THEN COALESCE(n.vgv_estimado, 0) ELSE 0 END) AS vgv_gerado,
      SUM(CASE WHEN n.data_assinatura BETWEEN p_start AND p_end AND n.conta_venda = 1 THEN COALESCE(n.vgv_efetivo, 0) ELSE 0 END) AS vgv_assinado
    FROM v_kpi_negocios n
    WHERE (p_user_id IS NULL OR n.auth_user_id = p_user_id)
      AND (
        (n.data_criacao BETWEEN p_start AND p_end)
        OR (n.data_assinatura BETWEEN p_start AND p_end AND n.conta_venda = 1)
      )
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
    COALESCE(vis.visitas_realizadas, 0),
    COALESCE(vis.visitas_no_show, 0),
    COALESCE(neg.propostas, 0),
    COALESCE(neg.vendas, 0),
    COALESCE(neg.vgv_gerado, 0),
    COALESCE(neg.vgv_assinado, 0),
    COALESCE(gest.pontos_gestao, 0),
    COALESCE(pres.dias_presente, 0),
    COALESCE(neg.perdidos, 0),
    COALESCE(neg.perdidos_unicos, 0)
  FROM all_users u
  LEFT JOIN lig ON lig.auth_user_id = u.auth_user_id
  LEFT JOIN vis ON vis.auth_user_id = u.auth_user_id
  LEFT JOIN neg ON neg.auth_user_id = u.auth_user_id
  LEFT JOIN gest ON gest.auth_user_id = u.auth_user_id
  LEFT JOIN pres ON pres.auth_user_id = u.auth_user_id
  WHERE COALESCE(lig.total_ligacoes, 0) > 0
     OR COALESCE(vis.visitas_marcadas, 0) > 0
     OR COALESCE(neg.propostas, 0) > 0
     OR COALESCE(neg.vendas, 0) > 0
     OR COALESCE(neg.perdidos, 0) > 0
     OR COALESCE(gest.pontos_gestao, 0) > 0
     OR COALESCE(pres.dias_presente, 0) > 0
     OR COALESCE(neg.vgv_assinado, 0) > 0;
$function$;
