
-- ───────────────────────────────────────────────────────────
-- Helper: classifica em segmento canônico (S1-S4)
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._central_segmento(p_emp text, p_seg uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_emp ILIKE '%casa tua%' OR p_emp ILIKE '%vivid%' THEN 'S3 - Foco'
    WHEN p_emp ILIKE '%átrio%' OR p_emp ILIKE '%atrio%' OR p_emp ILIKE '%shift%' OR p_emp ILIKE '%bastian%' THEN 'S2 - Investimento'
    WHEN p_emp ILIKE '%lake eyre%' OR p_emp ILIKE '%seen%' OR p_emp ILIKE '%high garden%' OR p_emp ILIKE '%boa vista country%' OR p_emp ILIKE '%alto padr%' THEN 'S4 - Alto Padrão'
    WHEN p_seg IN ('5311aaaa-0000-4000-8000-000000000005','5311bbbb-0000-4000-8000-000000000003') THEN 'S3 - Foco'
    WHEN p_seg IN ('409aeddf-077f-473a-97cc-dfc0692ed35e','dd96ad01-7e76-40e9-8324-211166168b26') THEN 'S2 - Investimento'
    WHEN p_seg IN ('93ca556c-9a32-4fb8-b1af-148100ea47f0','5e930c09-634d-40e1-9ccc-981b0a4eae74') THEN 'S4 - Alto Padrão'
    WHEN p_emp IS NULL OR btrim(p_emp) = '' THEN '(sem segmento)'
    ELSE 'S1 - Moradia'
  END
$$;

-- ───────────────────────────────────────────────────────────
-- Helper: normaliza canal de origem
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._central_origem(p_origem text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_origem IS NULL OR btrim(p_origem) = '' THEN '(sem origem)'
    WHEN p_origem ILIKE 'meta%' OR p_origem ILIKE '%facebook%' THEN 'Meta Ads'
    WHEN p_origem ILIKE 'oferta%ativa' OR p_origem = 'oferta_ativa' THEN 'Oferta Ativa'
    WHEN p_origem ILIKE 'imovelweb' THEN 'ImovelWeb'
    WHEN p_origem ILIKE 'site%' OR p_origem ILIKE '%landing%' THEN 'Site'
    WHEN p_origem ILIKE 'reengaj%' OR p_origem ILIKE 'nutri%' THEN 'Reengajamento/Nutrição'
    WHEN p_origem ILIKE 'indica%' THEN 'Indicação'
    WHEN p_origem ILIKE 'campanha%atrio%' THEN 'Campanha Átrio'
    WHEN p_origem = 'Manual' THEN 'Manual'
    ELSE initcap(p_origem)
  END
$$;

-- ───────────────────────────────────────────────────────────
-- Amplia get_relatorio_pipeline_leads com por_segmento + por_origem
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_relatorio_pipeline_leads(p_gestor_id uuid, p_start date, p_end date, p_prev_start date DEFAULT NULL::date, p_prev_end date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_auth uuid[]; v_team_prof uuid[];
  v_core jsonb; v_extras jsonb;
  v_pipeline_ativo int; v_total_ativos int; v_atualizados_48h int;
  v_leads_com_visita int;
  v_por_segmento jsonb; v_por_origem jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_gestor_id IS NULL THEN
    IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT DISTINCT user_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL)
                || ARRAY(SELECT DISTINCT gerente_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL);
  ELSE
    IF auth.uid() <> p_gestor_id AND NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
    v_team_auth := ARRAY(SELECT user_id FROM team_members WHERE gerente_id=p_gestor_id AND status='ativo') || ARRAY[p_gestor_id];
  END IF;
  v_team_prof := ARRAY(SELECT id FROM profiles WHERE user_id = ANY(v_team_auth));
  v_core := _kpi_team_window_core(v_team_auth, v_team_prof,
            p_start, p_end, p_prev_start, p_prev_end, true);
  SELECT COUNT(*) INTO v_pipeline_ativo
  FROM pipeline_leads pl
  JOIN pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(v_team_auth)
    AND COALESCE(pl.arquivado,false) = false
    AND ps.pipeline_tipo = 'leads'
    AND ps.tipo NOT IN ('convertido', 'descarte');
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE pl.ultima_acao_at >= now() - interval '48 hours')
    INTO v_total_ativos, v_atualizados_48h
  FROM pipeline_leads pl
  JOIN pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(v_team_auth)
    AND COALESCE(pl.arquivado,false) = false
    AND ps.pipeline_tipo = 'leads'
    AND ps.tipo NOT IN ('convertido', 'descarte');
  SELECT COUNT(DISTINCT v.pipeline_lead_id) INTO v_leads_com_visita
  FROM visitas v
  WHERE v.corretor_id = ANY(v_team_auth)
    AND v.data_visita BETWEEN p_start AND p_end
    AND v.pipeline_lead_id IS NOT NULL;

  -- POR SEGMENTO (leads recebidos, visitas realizadas, vendas e VGV no período)
  WITH seg_leads AS (
    SELECT _central_segmento(empreendimento, segmento_id) AS seg, COUNT(*) AS leads
    FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN p_start AND p_end
    GROUP BY 1
  ),
  seg_vis AS (
    SELECT _central_segmento(empreendimento, NULL) AS seg,
           COUNT(*) FILTER (WHERE status='realizada') AS visitas
    FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND data_visita BETWEEN p_start AND p_end
      AND (tipo IS NULL OR tipo='lead')
    GROUP BY 1
  ),
  seg_vgv AS (
    SELECT _central_segmento(empreendimento, NULL) AS seg,
           COUNT(*) AS vendas,
           SUM(COALESCE(vgv_final, vgv_estimado, 0)) AS vgv
    FROM negocios
    WHERE corretor_id = ANY(v_team_prof)
      AND fase = 'vendido'
      AND data_assinatura BETWEEN p_start AND p_end
    GROUP BY 1
  ),
  seg_all AS (
    SELECT seg FROM seg_leads
    UNION SELECT seg FROM seg_vis
    UNION SELECT seg FROM seg_vgv
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'segmento', a.seg,
           'leads', COALESCE(l.leads,0),
           'visitas', COALESCE(v.visitas,0),
           'vendas', COALESCE(g.vendas,0),
           'vgv', COALESCE(g.vgv,0)
         ) ORDER BY COALESCE(g.vgv,0) DESC, COALESCE(l.leads,0) DESC), '[]'::jsonb)
  INTO v_por_segmento
  FROM seg_all a
  LEFT JOIN seg_leads l ON l.seg = a.seg
  LEFT JOIN seg_vis   v ON v.seg = a.seg
  LEFT JOIN seg_vgv   g ON g.seg = a.seg;

  -- POR ORIGEM (funil canal: leads recebidos + quantos geraram visita)
  SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb ORDER BY (s.leads) DESC), '[]'::jsonb)
  INTO v_por_origem
  FROM (
    SELECT _central_origem(pl.origem) AS origem,
           COUNT(*) AS leads,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM visitas v
             WHERE v.pipeline_lead_id = pl.id
               AND v.data_visita BETWEEN p_start AND p_end
           )) AS com_visita,
           ROUND(
             COUNT(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM visitas v
               WHERE v.pipeline_lead_id = pl.id
                 AND v.data_visita BETWEEN p_start AND p_end
             )) * 100.0 / NULLIF(COUNT(*),0), 1) AS conv_pct
    FROM pipeline_leads pl
    WHERE pl.corretor_id = ANY(v_team_auth)
      AND (COALESCE(pl.aceito_em, pl.distribuido_em, pl.created_at) AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN p_start AND p_end
    GROUP BY 1
    ORDER BY leads DESC
    LIMIT 12
  ) s;

  v_extras := jsonb_build_object(
    'pipeline_ativo', v_pipeline_ativo,
    'taxa_atualizacao_48h', CASE WHEN v_total_ativos>0
        THEN ROUND((v_atualizados_48h::numeric / v_total_ativos)*100, 1) ELSE NULL END,
    'leads_com_visita_periodo', v_leads_com_visita,
    'conversao_lead_visita_pct', CASE WHEN (v_core->'leads'->>'recebidos')::int > 0
        THEN ROUND((v_leads_com_visita::numeric /
              (v_core->'leads'->>'recebidos')::int)*100, 1) ELSE NULL END,
    'por_segmento', v_por_segmento,
    'por_origem', v_por_origem
  );
  RETURN v_core || jsonb_build_object('extras', v_extras);
END $function$;
