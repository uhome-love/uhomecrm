DROP FUNCTION IF EXISTS public.get_relatorio_origem_performance(date, date, uuid[]);

CREATE OR REPLACE FUNCTION public.lead_teve_contato_v3(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(
      (SELECT s.ordem >= 1 AND s.ordem <= 7
         FROM pipeline_leads pl JOIN pipeline_stages s ON s.id = pl.stage_id
        WHERE pl.id = p_lead_id),
      false
    )
    OR EXISTS(SELECT 1 FROM whatsapp_mensagens wm WHERE wm.lead_id = p_lead_id AND wm.direction IN ('sent','out'))
    OR EXISTS(SELECT 1 FROM pipeline_atividades pa WHERE pa.pipeline_lead_id = p_lead_id
              AND (pa.tipo IN ('whatsapp','ligacao','call','email','contato','tarefa','mensagem','visita','reuniao','proposta','nao_atendeu')
                   OR pa.tipo_contato IS NOT NULL));
$$;

GRANT EXECUTE ON FUNCTION public.lead_teve_contato_v3(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_relatorio_origem_performance(
  p_start date, p_end date, p_corretor_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  lead_id uuid, nome text, created_at timestamptz, origem text, campanha text,
  conjunto_anuncio text, anuncio text, plataforma text, empreendimento text,
  corretor_id uuid, corretor_nome text, stage_nome text, stage_ordem int,
  motivo_descarte text, tipo_descarte text,
  primeiro_contato_em timestamptz, primeiro_contato_em_v1 timestamptz,
  origem_primeiro_contato text, tempo_ate_primeiro_contato_min integer,
  tem_visita_realizada boolean, tem_venda boolean, vgv numeric,
  teve_contato_v3 boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    pl.id, pl.nome, pl.created_at, pl.origem, pl.campanha, pl.conjunto_anuncio,
    pl.anuncio, pl.plataforma, pl.empreendimento, pl.corretor_id,
    p.nome, st.nome, st.ordem, pl.motivo_descarte, pl.tipo_descarte,
    pc.t, pl.primeiro_contato_em,
    CASE WHEN pc.origem_tag IS NOT NULL THEN pc.origem_tag
         WHEN st.ordem >= 1 AND st.ordem <= 7 THEN 'mudanca_etapa'
         ELSE NULL END,
    CASE WHEN pc.t IS NOT NULL
         THEN GREATEST(0, round(extract(epoch FROM (pc.t - pl.created_at))/60))::int
         ELSE NULL END,
    COALESCE(v.tem_visita, false), COALESCE(n.tem_venda, false), COALESCE(n.vgv, 0),
    (pc.t IS NOT NULL OR (st.ordem >= 1 AND st.ordem <= 7))
  FROM pipeline_leads pl
  LEFT JOIN profiles p ON p.user_id = pl.corretor_id
  LEFT JOIN pipeline_stages st ON st.id = pl.stage_id
  LEFT JOIN LATERAL (
    SELECT t, origem_tag FROM (
      SELECT min(w.timestamp) AS t, 'whatsapp'::text AS origem_tag
        FROM whatsapp_mensagens w
       WHERE w.lead_id = pl.id AND w.direction IN ('sent','out')
      UNION ALL
      SELECT min(a.created_at) AS t, 'atividade'::text AS origem_tag
        FROM pipeline_atividades a
       WHERE a.pipeline_lead_id = pl.id
         AND (a.tipo IN ('whatsapp','ligacao','contato','mensagem','email','visita','reuniao','proposta','nao_atendeu')
              OR a.tipo_contato IS NOT NULL)
    ) s WHERE t IS NOT NULL ORDER BY t ASC LIMIT 1
  ) pc ON true
  LEFT JOIN LATERAL (
    SELECT true AS tem_visita FROM visitas vi
     WHERE vi.pipeline_lead_id = pl.id AND vi.status = 'realizada' LIMIT 1
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT (count(*) > 0) AS tem_venda,
           sum(COALESCE(ng.vgv_final, ng.vgv_estimado, 0)) AS vgv
      FROM negocios ng
     WHERE ng.pipeline_lead_id = pl.id AND ng.fase = 'vendido'
  ) n ON true
  WHERE pl.created_at::date >= p_start
    AND pl.created_at::date <= p_end
    AND (p_corretor_ids IS NULL OR pl.corretor_id = ANY(p_corretor_ids));
$$;

GRANT EXECUTE ON FUNCTION public.get_relatorio_origem_performance(date, date, uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.monitor_primeiro_contato_v1_coverage()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total int; v_v1 int; v_v3 int;
  v_pct_v1 numeric; v_pct_v3 numeric; v_gap numeric;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE pl.primeiro_contato_em IS NOT NULL),
         COUNT(*) FILTER (
           WHERE pl.primeiro_contato_em IS NOT NULL
              OR EXISTS(SELECT 1 FROM whatsapp_mensagens wm WHERE wm.lead_id=pl.id AND wm.direction IN ('sent','out'))
              OR EXISTS(SELECT 1 FROM pipeline_atividades pa WHERE pa.pipeline_lead_id=pl.id AND (pa.tipo IN ('whatsapp','ligacao','call','email','contato','tarefa','mensagem','visita','reuniao','proposta','nao_atendeu') OR pa.tipo_contato IS NOT NULL))
              OR EXISTS(SELECT 1 FROM pipeline_stages s WHERE s.id=pl.stage_id AND s.ordem >= 1 AND s.ordem <= 7)
         )
  INTO v_total, v_v1, v_v3
  FROM pipeline_leads pl
  WHERE pl.created_at >= now() - interval '7 days';

  IF v_total = 0 THEN RETURN; END IF;

  v_pct_v1 := ROUND(100.0 * v_v1 / v_total, 2);
  v_pct_v3 := ROUND(100.0 * v_v3 / v_total, 2);
  v_gap := v_pct_v3 - v_pct_v1;

  INSERT INTO ops_events (fn, level, category, message, ctx)
  VALUES (
    'monitor_primeiro_contato_v1_coverage',
    CASE WHEN v_gap > 20 THEN 'warn' ELSE 'info' END,
    'monitoring_primeiro_contato_v1_coverage',
    format('Cobertura 7d — v1: %s%% (%s/%s) | v3: %s%% (%s/%s) | gap: %s pp',
           v_pct_v1, v_v1, v_total, v_pct_v3, v_v3, v_total, v_gap),
    jsonb_build_object(
      'window_days', 7, 'total_leads', v_total,
      'v1_filled', v_v1, 'v3_contato', v_v3,
      'pct_v1', v_pct_v1, 'pct_v3', v_pct_v3, 'gap_pp', v_gap
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.monitor_primeiro_contato_v1_coverage() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monitor_primeiro_contato_v1_coverage_weekly') THEN
      PERFORM cron.unschedule('monitor_primeiro_contato_v1_coverage_weekly');
    END IF;
    PERFORM cron.schedule(
      'monitor_primeiro_contato_v1_coverage_weekly',
      '0 12 * * 1',
      'SELECT public.monitor_primeiro_contato_v1_coverage();'
    );
  END IF;
END;
$$;

SELECT public.monitor_primeiro_contato_v1_coverage();