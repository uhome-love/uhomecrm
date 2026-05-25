-- ============================================================================
-- RPC 1: get_dashboard_gerente_v4_kpis
-- KPIs topo + alertas operacionais (top 5 corretores por score)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_gerente_v4_kpis(
  p_gestor_id uuid,
  p_periodo   text DEFAULT 'hoje'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now         timestamptz := now();
  v_today       date := (v_now AT TIME ZONE 'America/Sao_Paulo')::date;
  v_p_start     date;
  v_p_end       date;
  v_prev_start  date;
  v_prev_end    date;
  v_mes_key     text;
  v_meta        record;
  v_team_auth   uuid[];
  v_team_prof   uuid[];
  v_result      jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF auth.uid() <> p_gestor_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Janelas
  IF p_periodo = 'hoje' THEN
    v_p_start := v_today;                       v_p_end    := v_today;
    v_prev_start := v_today - INTERVAL '7 days'; v_prev_end := v_today - INTERVAL '7 days';
  ELSIF p_periodo = 'semana' THEN
    v_p_start := date_trunc('week', v_today)::date;
    v_p_end   := (date_trunc('week', v_today) + INTERVAL '6 days')::date;
    v_prev_start := (date_trunc('week', v_today) - INTERVAL '7 days')::date;
    v_prev_end   := (date_trunc('week', v_today) - INTERVAL '1 day')::date;
  ELSE
    v_p_start := date_trunc('month', v_today)::date;
    v_p_end   := (date_trunc('month', v_today) + INTERVAL '1 month - 1 day')::date;
    v_prev_start := (date_trunc('month', v_today) - INTERVAL '1 month')::date;
    v_prev_end   := (date_trunc('month', v_today) - INTERVAL '1 day')::date;
  END IF;

  v_mes_key := to_char(v_today, 'YYYY-MM');

  -- Time (auth ids)
  SELECT array_agg(user_id) INTO v_team_auth
  FROM team_members WHERE gerente_id = p_gestor_id AND status = 'ativo';
  IF v_team_auth IS NULL THEN v_team_auth := ARRAY[]::uuid[]; END IF;

  -- Time (profile ids) — derivado
  SELECT array_agg(id) INTO v_team_prof
  FROM profiles WHERE user_id = ANY(v_team_auth);
  IF v_team_prof IS NULL THEN v_team_prof := ARRAY[]::uuid[]; END IF;

  -- Metas
  SELECT * INTO v_meta FROM ceo_metas_mensais
  WHERE gerente_id = p_gestor_id AND mes = v_mes_key LIMIT 1;
  IF v_meta IS NULL THEN
    v_meta.meta_vgv_assinado := 0;
    v_meta.meta_leads := 400;
    v_meta.meta_visitas_realizadas := 0;
    v_meta.meta_negocios := 90;
  END IF;

  WITH
  vendas_atual AS (
    SELECT COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)),0)::numeric AS v,
           COUNT(*)::int AS qtd
    FROM negocios n
    WHERE n.corretor_id = ANY(v_team_prof)
      AND n.data_assinatura BETWEEN v_p_start AND v_p_end
  ),
  vendas_prev AS (
    SELECT COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)),0)::numeric AS v,
           COUNT(*)::int AS qtd
    FROM negocios n
    WHERE n.corretor_id = ANY(v_team_prof)
      AND n.data_assinatura BETWEEN v_prev_start AND v_prev_end
  ),
  leads_atual AS (
    SELECT COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN v_p_start AND v_p_end
  ),
  leads_prev AS (
    SELECT COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN v_prev_start AND v_prev_end
  ),
  visitas_atual AS (
    SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND data_visita BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead')
      AND status = 'realizada'
  ),
  visitas_prev AS (
    SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND data_visita BETWEEN v_prev_start AND v_prev_end
      AND (tipo IS NULL OR tipo = 'lead')
      AND status = 'realizada'
  ),
  -- AJUSTE B: visitas CRIADAS no período com status agendada/marcada/confirmada
  visitas_agendadas AS (
    SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead')
      AND status IN ('agendada','marcada','confirmada')
  ),
  negocios_ativos_total AS (
    SELECT COUNT(*)::int AS qtd FROM negocios
    WHERE corretor_id = ANY(v_team_prof) AND status = 'ativo'
  ),
  tarefas_atr AS (
    SELECT pt.corretor_id AS auth_id, COUNT(*)::int AS qtd
    FROM pipeline_tarefas pt
    WHERE pt.corretor_id = ANY(v_team_auth)
      AND pt.status = 'pendente'
      AND (
        pt.data_tarefa < v_today
        OR (pt.data_tarefa = v_today
            AND COALESCE(pt.hora_tarefa, '23:59'::time)
                < (v_now AT TIME ZONE 'America/Sao_Paulo')::time)
      )
    GROUP BY pt.corretor_id
  ),
  leads_sem_acao AS (
    SELECT pl.corretor_id AS auth_id, COUNT(*)::int AS qtd
    FROM pipeline_leads pl
    WHERE pl.corretor_id = ANY(v_team_auth)
      AND COALESCE(pl.arquivado, false) = false
      AND COALESCE(pl.ultima_acao_at, pl.primeiro_contato_em, pl.aceito_em, pl.created_at)
          < (v_now - INTERVAL '30 days')
    GROUP BY pl.corretor_id
  ),
  alertas_raw AS (
    SELECT
      tm.user_id AS auth_id,
      p.id       AS profile_id,
      p.nome,
      p.avatar_url,
      COALESCE(ta.qtd, 0) AS tarefas_atrasadas,
      COALESCE(ls.qtd, 0) AS leads_sem_acao_30d,
      COALESCE(ta.qtd, 0) + COALESCE(ls.qtd, 0) AS score_soma
    FROM team_members tm
    LEFT JOIN profiles p ON p.user_id = tm.user_id
    LEFT JOIN tarefas_atr ta ON ta.auth_id = tm.user_id
    LEFT JOIN leads_sem_acao ls ON ls.auth_id = tm.user_id
    WHERE tm.gerente_id = p_gestor_id AND tm.status = 'ativo'
  ),
  alertas_filtrados AS (
    SELECT * FROM alertas_raw
    WHERE score_soma >= 40
    ORDER BY score_soma DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'kpis_top', jsonb_build_object(
      'leads_recebidos',          (SELECT qtd FROM leads_atual),
      'leads_recebidos_anterior', (SELECT qtd FROM leads_prev),
      'leads_meta',               v_meta.meta_leads,
      'leads_delta_pct',          CASE WHEN (SELECT qtd FROM leads_prev) = 0 THEN NULL
                                       ELSE ROUND((((SELECT qtd FROM leads_atual)::numeric
                                                     - (SELECT qtd FROM leads_prev))
                                                    / (SELECT qtd FROM leads_prev)) * 100, 1) END,

      'visitas_realizadas',       (SELECT qtd FROM visitas_atual),
      'visitas_agendadas',        (SELECT qtd FROM visitas_agendadas),
      'visitas_meta',             v_meta.meta_visitas_realizadas,
      'visitas_delta_pct',        CASE WHEN (SELECT qtd FROM visitas_prev) = 0 THEN NULL
                                       ELSE ROUND((((SELECT qtd FROM visitas_atual)::numeric
                                                     - (SELECT qtd FROM visitas_prev))
                                                    / (SELECT qtd FROM visitas_prev)) * 100, 1) END,

      'negocios_ativos',          (SELECT qtd FROM negocios_ativos_total),
      'negocios_meta',            v_meta.meta_negocios,

      'vendas_vgv',               (SELECT v FROM vendas_atual),
      'vendas_count',             (SELECT qtd FROM vendas_atual),
      'vendas_meta_vgv',          v_meta.meta_vgv_assinado,
      'vendas_delta_pct',         CASE WHEN (SELECT v FROM vendas_prev) = 0 THEN NULL
                                       ELSE ROUND((((SELECT v FROM vendas_atual)
                                                     - (SELECT v FROM vendas_prev))
                                                    / (SELECT v FROM vendas_prev)) * 100, 1) END,

      'periodo', p_periodo,
      'p_start', v_p_start,
      'p_end',   v_p_end
    ),
    'alertas_corretores', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'corretor_id',         a.profile_id,
        'auth_id',             a.auth_id,
        'nome',                a.nome,
        'avatar_url',          a.avatar_url,
        'tarefas_atrasadas',   a.tarefas_atrasadas,
        'leads_sem_acao_30d',  a.leads_sem_acao_30d,
        'score_soma',          a.score_soma,
        'severity',            CASE WHEN a.score_soma >= 70 THEN 'critico' ELSE 'atencao' END
      ) ORDER BY a.score_soma DESC)
       FROM alertas_filtrados a),
      '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;


-- ============================================================================
-- RPC 2: get_dashboard_gerente_v4_dia
-- Visitas (hoje|semana) + mini-pipeline 4 fases + roleta do dia
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_gerente_v4_dia(
  p_gestor_id     uuid,
  p_visitas_range text DEFAULT 'hoje'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now           timestamptz := now();
  v_now_brt       timestamp   := (v_now AT TIME ZONE 'America/Sao_Paulo');
  v_today         date        := v_now_brt::date;
  v_minutes_brt   int         := EXTRACT(HOUR FROM v_now_brt)::int * 60
                               + EXTRACT(MINUTE FROM v_now_brt)::int;
  v_turno_atual   text;
  v_v_start       date;
  v_v_end         date;
  v_team_auth     uuid[];
  v_team_prof     uuid[];
  v_visitas       jsonb;
  v_pipeline      jsonb;
  v_roleta        jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF auth.uid() <> p_gestor_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Turno ativo BRT (faixas iguais a useElegibilidadeRoleta)
  v_turno_atual := CASE
    WHEN v_minutes_brt < (13*60 + 30) THEN 'manha'
    WHEN v_minutes_brt < (18*60 + 30) THEN 'tarde'
    ELSE 'noturna'
  END;

  -- Janela de visitas
  IF p_visitas_range = 'semana' THEN
    v_v_start := date_trunc('week', v_today)::date;
    v_v_end   := (date_trunc('week', v_today) + INTERVAL '6 days')::date;
  ELSE
    v_v_start := v_today;
    v_v_end   := v_today;
  END IF;

  -- Time
  SELECT array_agg(user_id) INTO v_team_auth
  FROM team_members WHERE gerente_id = p_gestor_id AND status = 'ativo';
  IF v_team_auth IS NULL THEN v_team_auth := ARRAY[]::uuid[]; END IF;

  SELECT array_agg(id) INTO v_team_prof
  FROM profiles WHERE user_id = ANY(v_team_auth);
  IF v_team_prof IS NULL THEN v_team_prof := ARRAY[]::uuid[]; END IF;

  -- Visitas (até 10)
  SELECT COALESCE(jsonb_agg(row_to_json(v_row) ORDER BY v_row.data_visita, v_row.hora_visita), '[]'::jsonb)
  INTO v_visitas
  FROM (
    SELECT
      v.id                                        AS visita_id,
      v.data_visita,
      to_char(v.hora_visita, 'HH24:MI')           AS horario_str,
      v.hora_visita,
      v.nome_cliente                              AS cliente_nome,
      COALESCE(v.empreendimento, v.local_visita)  AS imovel_resumo,
      v.corretor_id,
      p.nome                                      AS corretor_nome,
      p.avatar_url                                AS corretor_avatar,
      v.status
    FROM visitas v
    LEFT JOIN profiles p ON p.user_id = v.corretor_id
    WHERE v.corretor_id = ANY(v_team_auth)
      AND v.data_visita BETWEEN v_v_start AND v_v_end
      AND (v.tipo IS NULL OR v.tipo = 'lead')
    ORDER BY v.data_visita, v.hora_visita NULLS LAST
    LIMIT 10
  ) v_row;

  -- Mini-pipeline (4 fases fixas, top 3 cards cada)
  WITH fases AS (
    SELECT * FROM (VALUES
      ('novo_negocio', 'Novo Negócio',    1),
      ('proposta',     'Proposta',        2),
      ('negociacao',   'Negociação',      3),
      ('documentacao', 'Contrato Gerado', 4)
    ) AS f(fase, fase_label, ordem)
  ),
  counts AS (
    SELECT n.fase, COUNT(*)::int AS qtd
    FROM negocios n
    WHERE n.corretor_id = ANY(v_team_prof)
      AND n.status = 'ativo'
      AND n.fase IN ('novo_negocio','proposta','negociacao','documentacao')
    GROUP BY n.fase
  ),
  top_per_fase AS (
    SELECT
      f.fase,
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'negocio_id',   t.id,
          'cliente_nome', t.nome_cliente,
          'vgv',          COALESCE(t.vgv_final, t.vgv_estimado, 0)
        ) ORDER BY t.updated_at DESC
      ) FILTER (WHERE t.id IS NOT NULL), '[]'::jsonb) AS cards
    FROM fases f
    LEFT JOIN LATERAL (
      SELECT n.id, n.nome_cliente, n.vgv_final, n.vgv_estimado, n.updated_at
      FROM negocios n
      WHERE n.corretor_id = ANY(v_team_prof)
        AND n.status = 'ativo'
        AND n.fase = f.fase
      ORDER BY n.updated_at DESC
      LIMIT 3
    ) t ON true
    GROUP BY f.fase
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'fase',       f.fase,
      'fase_label', f.fase_label,
      'ordem',      f.ordem,
      'count_total', COALESCE(c.qtd, 0),
      'top_cards',   COALESCE(tp.cards, '[]'::jsonb)
    ) ORDER BY f.ordem
  )
  INTO v_pipeline
  FROM fases f
  LEFT JOIN counts c ON c.fase = f.fase
  LEFT JOIN top_per_fase tp ON tp.fase = f.fase;

  -- Roleta do dia (todos credenciados, indicador de turno ativo agora)
  WITH cred AS (
    SELECT rc.corretor_id, rc.janela
    FROM roleta_credenciamentos rc
    WHERE rc.data = v_today
      AND rc.status = 'aprovado'
      AND rc.saiu_em IS NULL
      AND rc.corretor_id = ANY(v_team_prof)
  ),
  dist_dia AS (
    SELECT
      rd.corretor_id,
      COUNT(*) FILTER (
        WHERE (rd.enviado_em AT TIME ZONE 'America/Sao_Paulo')::date = v_today
      )::int AS recebidos,
      COUNT(*) FILTER (
        WHERE rd.aceito_em IS NOT NULL
          AND (rd.aceito_em AT TIME ZONE 'America/Sao_Paulo')::date = v_today
      )::int AS aceitos
    FROM roleta_distribuicoes rd
    WHERE rd.corretor_id IN (SELECT corretor_id FROM cred)
    GROUP BY rd.corretor_id
  )
  SELECT jsonb_build_object(
    'turno_ativo_atual', v_turno_atual,
    'credenciados', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'corretor_id',          c.corretor_id,
        'nome',                 p.nome,
        'avatar_url',           p.avatar_url,
        'janela',               c.janela,
        'turno_ativo_agora',    (c.janela = v_turno_atual OR c.janela = 'dia_todo'),
        'leads_recebidos_dia',  COALESCE(d.recebidos, 0),
        'leads_aceitos_dia',    COALESCE(d.aceitos, 0)
      ) ORDER BY
        (c.janela = v_turno_atual OR c.janela = 'dia_todo') DESC,
        p.nome ASC
      )
       FROM cred c
       LEFT JOIN profiles p ON p.id = c.corretor_id
       LEFT JOIN dist_dia d ON d.corretor_id = c.corretor_id),
      '[]'::jsonb
    )
  ) INTO v_roleta;

  RETURN jsonb_build_object(
    'visitas',       v_visitas,
    'mini_pipeline', v_pipeline,
    'roleta_dia',    v_roleta
  );
END;
$function$;