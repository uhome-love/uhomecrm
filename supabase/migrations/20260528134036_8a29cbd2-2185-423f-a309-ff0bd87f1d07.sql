SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- =====================================================
-- 1) get_relatorio_pipeline_leads
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_relatorio_pipeline_leads(
  p_gestor_id uuid, p_start date, p_end date,
  p_prev_start date DEFAULT NULL, p_prev_end date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_team_auth uuid[]; v_team_prof uuid[];
  v_core jsonb; v_extras jsonb;
  v_pipeline_ativo int; v_total_ativos int; v_atualizados_48h int;
  v_leads_com_visita int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF auth.uid() <> p_gestor_id
     AND NOT has_role(auth.uid(),'admin'::app_role)
  THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_team_auth := ARRAY(SELECT user_id FROM team_members
                       WHERE gerente_id=p_gestor_id AND status='ativo')
                 || ARRAY[p_gestor_id];
  v_team_prof := ARRAY(SELECT id FROM profiles WHERE user_id = ANY(v_team_auth));

  v_core := _kpi_team_window_core(v_team_auth, v_team_prof,
            p_start, p_end, p_prev_start, p_prev_end, true);

  SELECT COUNT(*) INTO v_pipeline_ativo
  FROM pipeline_leads pl
  JOIN pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(v_team_auth)
    AND COALESCE(pl.arquivado,false) = false
    AND ps.tipo = 'ativo';

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE pl.ultima_acao_at >= now() - interval '48 hours')
    INTO v_total_ativos, v_atualizados_48h
  FROM pipeline_leads pl
  JOIN pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(v_team_auth)
    AND COALESCE(pl.arquivado,false) = false
    AND ps.tipo = 'ativo';

  SELECT COUNT(DISTINCT v.pipeline_lead_id) INTO v_leads_com_visita
  FROM visitas v
  WHERE v.corretor_id = ANY(v_team_auth)
    AND v.data_visita BETWEEN p_start AND p_end
    AND v.pipeline_lead_id IS NOT NULL;

  v_extras := jsonb_build_object(
    'pipeline_ativo', v_pipeline_ativo,
    'taxa_atualizacao_48h', CASE WHEN v_total_ativos>0
        THEN ROUND((v_atualizados_48h::numeric / v_total_ativos)*100, 1) ELSE NULL END,
    'leads_com_visita_periodo', v_leads_com_visita,
    'conversao_lead_visita_pct', CASE WHEN (v_core->'leads'->>'recebidos')::int > 0
        THEN ROUND((v_leads_com_visita::numeric /
              (v_core->'leads'->>'recebidos')::int)*100, 1) ELSE NULL END
  );

  RETURN v_core || jsonb_build_object('extras', v_extras);
END $$;

-- =====================================================
-- 2) get_relatorio_oferta_ativa
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_relatorio_oferta_ativa(
  p_gestor_id uuid, p_start date, p_end date,
  p_prev_start date DEFAULT NULL, p_prev_end date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_team_auth uuid[]; v_team_prof uuid[];
  v_core jsonb; v_extras jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF auth.uid() <> p_gestor_id
     AND NOT has_role(auth.uid(),'admin'::app_role)
  THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_team_auth := ARRAY(SELECT user_id FROM team_members
                       WHERE gerente_id=p_gestor_id AND status='ativo')
                 || ARRAY[p_gestor_id];
  v_team_prof := ARRAY(SELECT id FROM profiles WHERE user_id = ANY(v_team_auth));

  v_core := _kpi_team_window_core(v_team_auth, v_team_prof,
            p_start, p_end, p_prev_start, p_prev_end, true);

  WITH t AS (
    SELECT ot.lista_id,
           COALESCE(l.nome,'(sem lista)') AS lista_nome,
           COUNT(*) AS tentativas,
           COUNT(*) FILTER (WHERE ot.resultado='com_interesse') AS aproveitados
    FROM oferta_ativa_tentativas ot
    LEFT JOIN oferta_ativa_listas l ON l.id = ot.lista_id
    WHERE ot.corretor_id = ANY(v_team_auth)
      AND ot.created_at::date BETWEEN p_start AND p_end
    GROUP BY ot.lista_id, l.nome
    ORDER BY tentativas DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'top_listas_origem', COALESCE(jsonb_agg(jsonb_build_object(
      'lista_id', lista_id,
      'lista_nome', lista_nome,
      'tentativas', tentativas,
      'aproveitados', aproveitados,
      'taxa_pct', CASE WHEN tentativas>0
          THEN ROUND((aproveitados::numeric/tentativas)*100,1) ELSE 0 END
    )), '[]'::jsonb)
  ) INTO v_extras FROM t;

  RETURN v_core || jsonb_build_object('extras', v_extras);
END $$;

-- =====================================================
-- 3) get_relatorio_visitas
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_relatorio_visitas(
  p_gestor_id uuid, p_start date, p_end date,
  p_prev_start date DEFAULT NULL, p_prev_end date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_team_auth uuid[]; v_team_prof uuid[];
  v_core jsonb; v_extras jsonb;
  v_por_dia jsonb; v_por_emp jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF auth.uid() <> p_gestor_id
     AND NOT has_role(auth.uid(),'admin'::app_role)
  THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_team_auth := ARRAY(SELECT user_id FROM team_members
                       WHERE gerente_id=p_gestor_id AND status='ativo')
                 || ARRAY[p_gestor_id];
  v_team_prof := ARRAY(SELECT id FROM profiles WHERE user_id = ANY(v_team_auth));

  v_core := _kpi_team_window_core(v_team_auth, v_team_prof,
            p_start, p_end, p_prev_start, p_prev_end, true);

  SELECT COALESCE(jsonb_object_agg(dow::text, qtd),'{}'::jsonb) INTO v_por_dia
  FROM (
    SELECT EXTRACT(DOW FROM data_visita)::int AS dow, COUNT(*) AS qtd
    FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND data_visita BETWEEN p_start AND p_end
    GROUP BY 1
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'empreendimento', empreendimento,
           'criadas', criadas,
           'realizadas', realizadas)),'[]'::jsonb) INTO v_por_emp
  FROM (
    SELECT COALESCE(empreendimento,'(sem)') AS empreendimento,
           COUNT(*) AS criadas,
           COUNT(*) FILTER (WHERE status='realizada') AS realizadas
    FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND data_visita BETWEEN p_start AND p_end
    GROUP BY 1
    ORDER BY criadas DESC
    LIMIT 10
  ) s;

  v_extras := jsonb_build_object(
    'por_dia_semana', v_por_dia,
    'por_empreendimento', v_por_emp
  );

  RETURN v_core || jsonb_build_object('extras', v_extras);
END $$;

-- =====================================================
-- 4) get_relatorio_negocios
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_relatorio_negocios(
  p_gestor_id uuid, p_start date, p_end date,
  p_prev_start date DEFAULT NULL, p_prev_end date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_team_auth uuid[]; v_team_prof uuid[];
  v_core jsonb; v_extras jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF auth.uid() <> p_gestor_id
     AND NOT has_role(auth.uid(),'admin'::app_role)
  THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_team_auth := ARRAY(SELECT user_id FROM team_members
                       WHERE gerente_id=p_gestor_id AND status='ativo')
                 || ARRAY[p_gestor_id];
  v_team_prof := ARRAY(SELECT id FROM profiles WHERE user_id = ANY(v_team_auth));

  v_core := _kpi_team_window_core(v_team_auth, v_team_prof,
            p_start, p_end, p_prev_start, p_prev_end, true);

  WITH f AS (
    SELECT COALESCE(fase,'(sem fase)') AS fase,
           COUNT(*) AS qtd,
           AVG(COALESCE(vgv_final, vgv_estimado))::numeric AS ticket_medio,
           AVG(EXTRACT(EPOCH FROM (now() - fase_changed_at))/86400)::numeric AS dias_em_fase
    FROM negocios
    WHERE corretor_id = ANY(v_team_prof)
      AND status NOT IN ('vendido','perdido','cancelado')
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'por_fase', COALESCE(jsonb_agg(jsonb_build_object(
      'fase', fase, 'qtd', qtd,
      'ticket_medio', ROUND(ticket_medio,2),
      'tempo_medio_em_fase_dias', ROUND(dias_em_fase,1)
    )),'[]'::jsonb)
  ) INTO v_extras FROM f;

  RETURN v_core || jsonb_build_object('extras', v_extras);
END $$;

-- =====================================================
-- 5) get_relatorio_vendas
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_relatorio_vendas(
  p_gestor_id uuid, p_start date, p_end date,
  p_prev_start date DEFAULT NULL, p_prev_end date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_team_auth uuid[]; v_team_prof uuid[];
  v_core jsonb; v_extras jsonb;
  v_por_emp jsonb; v_por_dia jsonb;
  v_comissao_real numeric; v_comissao_fallback numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF auth.uid() <> p_gestor_id
     AND NOT has_role(auth.uid(),'admin'::app_role)
  THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_team_auth := ARRAY(SELECT user_id FROM team_members
                       WHERE gerente_id=p_gestor_id AND status='ativo')
                 || ARRAY[p_gestor_id];
  v_team_prof := ARRAY(SELECT id FROM profiles WHERE user_id = ANY(v_team_auth));

  v_core := _kpi_team_window_core(v_team_auth, v_team_prof,
            p_start, p_end, p_prev_start, p_prev_end, true);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'empreendimento', empreendimento,
           'count', cnt, 'vgv', vgv)),'[]'::jsonb) INTO v_por_emp
  FROM (
    SELECT COALESCE(empreendimento,'(sem)') AS empreendimento,
           COUNT(*) AS cnt,
           SUM(COALESCE(vgv_final, vgv_estimado)) AS vgv
    FROM negocios
    WHERE corretor_id = ANY(v_team_prof)
      AND data_assinatura BETWEEN p_start AND p_end
    GROUP BY 1 ORDER BY vgv DESC NULLS LAST LIMIT 10
  ) s;

  SELECT COALESCE(jsonb_object_agg(dia, jsonb_build_object('count',cnt,'vgv',vgv)),
                  '{}'::jsonb) INTO v_por_dia
  FROM (
    SELECT data_assinatura::text AS dia,
           COUNT(*) AS cnt,
           SUM(COALESCE(vgv_final,vgv_estimado)) AS vgv
    FROM negocios
    WHERE corretor_id = ANY(v_team_prof)
      AND data_assinatura BETWEEN p_start AND p_end
    GROUP BY 1
  ) s;

  SELECT COALESCE(SUM(pc.valor_comissao),0) INTO v_comissao_real
  FROM negocios n
  JOIN pipeline_comissoes pc ON pc.pipeline_lead_id = n.pipeline_lead_id
                            AND pc.corretor_id = n.corretor_id
  WHERE n.corretor_id = ANY(v_team_prof)
    AND n.data_assinatura BETWEEN p_start AND p_end;

  SELECT COALESCE(SUM(COALESCE(vgv_final,vgv_estimado)) * 0.04,0)
    INTO v_comissao_fallback
  FROM negocios n
  WHERE n.corretor_id = ANY(v_team_prof)
    AND n.data_assinatura BETWEEN p_start AND p_end
    AND NOT EXISTS (SELECT 1 FROM pipeline_comissoes pc
                    WHERE pc.pipeline_lead_id = n.pipeline_lead_id
                      AND pc.corretor_id = n.corretor_id);

  v_extras := jsonb_build_object(
    'por_empreendimento', v_por_emp,
    'por_dia', v_por_dia,
    'comissao_estimada', ROUND(v_comissao_real + v_comissao_fallback, 2),
    'comissao_fonte', CASE WHEN v_comissao_real>0 AND v_comissao_fallback>0 THEN 'mista'
                           WHEN v_comissao_real>0 THEN 'registrada'
                           ELSE 'fallback_4pct' END
  );

  RETURN v_core || jsonb_build_object('extras', v_extras);
END $$;

-- =====================================================
-- 6) get_ranking_central
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_ranking_central(
  p_gestor_id uuid, p_start date, p_end date
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_team_auth uuid[]; v_team_prof uuid[]; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF auth.uid() <> p_gestor_id
     AND NOT has_role(auth.uid(),'admin'::app_role)
  THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_team_auth := ARRAY(SELECT user_id FROM team_members
                       WHERE gerente_id=p_gestor_id AND status='ativo')
                 || ARRAY[p_gestor_id];
  v_team_prof := ARRAY(SELECT id FROM profiles WHERE user_id = ANY(v_team_auth));

  WITH base AS (
    SELECT DISTINCT
           tm.user_id        AS auth_id,
           p.id              AS profile_id,
           p.nome            AS corretor_nome,
           p.avatar_url
    FROM team_members tm
    JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.user_id = ANY(v_team_auth) AND tm.status='ativo'
  ),
  vendas AS (
    SELECT corretor_id AS profile_id,
           COUNT(*)::int AS qtd_vendas,
           SUM(COALESCE(vgv_final,vgv_estimado))::numeric AS vgv
    FROM negocios
    WHERE corretor_id = ANY(v_team_prof)
      AND data_assinatura BETWEEN p_start AND p_end
    GROUP BY 1
  ),
  vis AS (
    SELECT corretor_id AS auth_id,
           COUNT(*)::int AS visitas_criadas,
           COUNT(*) FILTER (WHERE status='realizada')::int AS visitas_realizadas
    FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND data_visita BETWEEN p_start AND p_end
    GROUP BY 1
  ),
  leads AS (
    SELECT corretor_id AS auth_id, COUNT(*)::int AS leads_recebidos
    FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND created_at::date BETWEEN p_start AND p_end
    GROUP BY 1
  ),
  oa AS (
    SELECT corretor_id AS auth_id,
           COUNT(*)::int AS oa_tentativas,
           SUM(pontos)::int AS oa_pontos
    FROM oferta_ativa_tentativas
    WHERE corretor_id = ANY(v_team_auth)
      AND created_at::date BETWEEN p_start AND p_end
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('start',p_start,'end',p_end),
    'corretores', COALESCE(jsonb_agg(jsonb_build_object(
      'corretor_auth_id', b.auth_id,
      'corretor_profile_id', b.profile_id,
      'nome', b.corretor_nome,
      'avatar_url', b.avatar_url,
      'vendas_qtd', COALESCE(v.qtd_vendas,0),
      'vendas_vgv', COALESCE(v.vgv,0),
      'visitas_criadas', COALESCE(vi.visitas_criadas,0),
      'visitas_realizadas', COALESCE(vi.visitas_realizadas,0),
      'leads_recebidos', COALESCE(l.leads_recebidos,0),
      'oa_tentativas', COALESCE(o.oa_tentativas,0),
      'oa_pontos', COALESCE(o.oa_pontos,0)
    ) ORDER BY COALESCE(v.vgv,0) DESC),'[]'::jsonb)
  ) INTO v_result
  FROM base b
  LEFT JOIN vendas v  ON v.profile_id = b.profile_id
  LEFT JOIN vis vi    ON vi.auth_id   = b.auth_id
  LEFT JOIN leads l   ON l.auth_id    = b.auth_id
  LEFT JOIN oa o      ON o.auth_id    = b.auth_id;

  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.get_relatorio_pipeline_leads(uuid,date,date,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatorio_oferta_ativa(uuid,date,date,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatorio_visitas(uuid,date,date,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatorio_negocios(uuid,date,date,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatorio_vendas(uuid,date,date,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_central(uuid,date,date) TO authenticated;