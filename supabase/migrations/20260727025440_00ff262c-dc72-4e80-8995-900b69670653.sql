
CREATE OR REPLACE FUNCTION public.rpc_perf_dashboard(
  p_inicio date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '30 days',
  p_fim    date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := has_role(v_uid, 'admin'::app_role) OR has_role(v_uid, 'diretor'::app_role);
  v_is_gestor boolean := has_role(v_uid, 'gestor'::app_role);
  v_ini timestamptz := (p_inicio::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := ((p_fim + 1)::text || ' 00:00:00-03')::timestamptz;
  v_dias_uteis int;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  -- Universo de corretores visíveis (auth_user_id, profile_id, nome)
  CREATE TEMP TABLE _perf_universo ON COMMIT DROP AS
  SELECT p.id AS profile_id, p.user_id AS auth_user_id, p.nome
    FROM public.profiles p
   WHERE p.user_id IS NOT NULL
     AND (
       v_is_admin
       OR (v_is_gestor AND EXISTS (
             SELECT 1 FROM public.team_members tm
              WHERE tm.gerente_id = v_uid AND tm.user_id = p.user_id
           ))
       OR p.user_id = v_uid
     );

  -- Dias úteis (seg-sáb, exclui feriados) no período
  SELECT COUNT(*) INTO v_dias_uteis
    FROM generate_series(p_inicio, p_fim, interval '1 day') d
   WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 6
     AND NOT EXISTS (SELECT 1 FROM public.feriados f WHERE f.data = d::date);
  v_dias_uteis := GREATEST(v_dias_uteis, 1);

  -- Métricas por corretor
  CREATE TEMP TABLE _perf_metricas ON COMMIT DROP AS
  WITH vgv AS (
    SELECT n.corretor_id AS profile_id,
           COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)), 0) AS vgv_vendido,
           COUNT(*) AS qtd_ganho
      FROM public.negocios n
     WHERE n.fase = 'ganho'
       AND n.data_assinatura BETWEEN p_inicio AND p_fim
     GROUP BY 1
  ), fases AS (
    SELECT n.corretor_id AS profile_id,
           COUNT(*) FILTER (WHERE n.fase = 'contrato')      AS qtd_contrato,
           COUNT(*) FILTER (WHERE n.fase = 'em_negociacao') AS qtd_negociacao
      FROM public.negocios n
     WHERE n.status = 'ativo'
     GROUP BY 1
  ), visitas AS (
    SELECT v.corretor_id AS profile_id,
           COUNT(*) FILTER (WHERE v.status = 'realizada') AS qtd_visitas_realizadas,
           COUNT(*) FILTER (WHERE v.status = 'no_show')   AS qtd_no_show,
           COUNT(*) AS qtd_visitas_total
      FROM public.visitas v
     WHERE v.data_visita BETWEEN p_inicio AND p_fim
     GROUP BY 1
  ), oa AS (
    SELECT t.corretor_id AS profile_id,
           COUNT(*) AS qtd_tentativas_oa,
           COUNT(*) FILTER (WHERE t.resultado = 'aproveitado') AS qtd_oa_aproveitados
      FROM public.oferta_ativa_tentativas t
     WHERE t.created_at >= v_ini AND t.created_at < v_fim
     GROUP BY 1
  ), presenca AS (
    SELECT rc.corretor_id AS profile_id,
           COUNT(DISTINCT rc.data) AS dias_presenca
      FROM public.roleta_credenciamentos rc
     WHERE rc.status = 'aprovado'
       AND rc.data BETWEEN p_inicio AND p_fim
     GROUP BY 1
  ), sla AS (
    SELECT pl.corretor_id AS profile_id,
           percentile_disc(0.5) WITHIN GROUP (
             ORDER BY EXTRACT(EPOCH FROM (pl.primeiro_contato_em - pl.distribuido_em))/60
           ) AS sla_mediana_min,
           COUNT(*) FILTER (WHERE pl.primeiro_contato_em IS NULL) AS qtd_sem_contato
      FROM public.pipeline_leads pl
     WHERE pl.distribuido_em >= v_ini AND pl.distribuido_em < v_fim
       AND pl.corretor_id IS NOT NULL
     GROUP BY 1
  )
  SELECT u.profile_id, u.auth_user_id, u.nome,
         COALESCE(vgv.vgv_vendido, 0)             AS vgv_vendido,
         COALESCE(vgv.qtd_ganho, 0)               AS qtd_ganho,
         COALESCE(fases.qtd_contrato, 0)          AS qtd_contrato,
         COALESCE(fases.qtd_negociacao, 0)        AS qtd_negociacao,
         COALESCE(visitas.qtd_visitas_realizadas, 0) AS qtd_visitas_realizadas,
         COALESCE(visitas.qtd_no_show, 0)         AS qtd_no_show,
         COALESCE(visitas.qtd_visitas_total, 0)   AS qtd_visitas_total,
         COALESCE(oa.qtd_tentativas_oa, 0)        AS qtd_tentativas_oa,
         COALESCE(oa.qtd_oa_aproveitados, 0)      AS qtd_oa_aproveitados,
         COALESCE(presenca.dias_presenca, 0)      AS dias_presenca,
         ROUND(COALESCE(presenca.dias_presenca, 0)::numeric / v_dias_uteis, 3) AS presenca_pct,
         sla.sla_mediana_min,
         COALESCE(sla.qtd_sem_contato, 0)         AS qtd_sem_contato
    FROM _perf_universo u
    LEFT JOIN vgv      ON vgv.profile_id      = u.profile_id
    LEFT JOIN fases    ON fases.profile_id    = u.profile_id
    LEFT JOIN visitas  ON visitas.profile_id  = u.profile_id
    LEFT JOIN oa       ON oa.profile_id       = u.profile_id
    LEFT JOIN presenca ON presenca.profile_id = u.profile_id
    LEFT JOIN sla      ON sla.profile_id      = u.profile_id;

  -- Monta JSON de saída
  WITH thresholds AS (
    SELECT jsonb_object_agg(chave, valor) AS t FROM public.perf_thresholds
  ),
  ranking AS (
    SELECT jsonb_agg(row_to_json(m) ORDER BY vgv_vendido DESC, qtd_visitas_realizadas DESC) AS arr
      FROM _perf_metricas m
  ),
  diagnostico AS (
    SELECT jsonb_agg(row_to_json(d)) FILTER (WHERE d.severidade IS NOT NULL) AS arr
      FROM (
        SELECT m.profile_id, m.nome,
               CASE
                 WHEN m.sla_mediana_min > 60*24 THEN 'sla_vermelho'
                 WHEN m.qtd_visitas_total > 0 AND (m.qtd_no_show::numeric/m.qtd_visitas_total) > 0.35 THEN 'no_show_alto'
                 WHEN m.qtd_negociacao > 15 THEN 'wip_negociacao_alto'
                 WHEN m.qtd_tentativas_oa < 5 AND m.dias_presenca > 3 THEN 'baixo_esforco_oa'
                 WHEN m.vgv_vendido = 0 AND m.qtd_visitas_realizadas = 0 THEN 'vgv_zerado'
                 WHEN m.presenca_pct < 0.4 THEN 'presenca_baixa'
                 ELSE NULL
               END AS severidade,
               jsonb_build_object(
                 'vgv_vendido', m.vgv_vendido,
                 'sla_mediana_min', m.sla_mediana_min,
                 'qtd_no_show', m.qtd_no_show,
                 'qtd_tentativas_oa', m.qtd_tentativas_oa,
                 'presenca_pct', m.presenca_pct,
                 'qtd_negociacao', m.qtd_negociacao
               ) AS contexto
          FROM _perf_metricas m
        ORDER BY (m.sla_mediana_min IS NOT NULL)::int DESC, m.vgv_vendido ASC
        LIMIT 3
      ) d
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'dias_uteis', v_dias_uteis),
    'thresholds', (SELECT t FROM thresholds),
    'ranking', COALESCE((SELECT arr FROM ranking), '[]'::jsonb),
    'diagnostico', COALESCE((SELECT arr FROM diagnostico), '[]'::jsonb),
    'escopo', CASE WHEN v_is_admin THEN 'admin'
                   WHEN v_is_gestor THEN 'gestor'
                   ELSE 'self' END
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_perf_dashboard(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_perf_dashboard(date, date) TO authenticated;
