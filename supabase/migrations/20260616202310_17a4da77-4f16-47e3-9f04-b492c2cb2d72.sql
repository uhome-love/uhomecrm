-- Visao consolidada da Diretora Comercial (Gabrielle)
CREATE TABLE IF NOT EXISTS public.diretoria_equipes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diretor_auth_id uuid NOT NULL,
  gerente_auth_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diretor_auth_id, gerente_auth_id)
);
GRANT SELECT ON public.diretoria_equipes TO authenticated;
GRANT ALL ON public.diretoria_equipes TO service_role;
ALTER TABLE public.diretoria_equipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read diretoria_equipes" ON public.diretoria_equipes;
CREATE POLICY "Authenticated can read diretoria_equipes" ON public.diretoria_equipes
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage diretoria_equipes" ON public.diretoria_equipes;
CREATE POLICY "Admins manage diretoria_equipes" ON public.diretoria_equipes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.resolve_managed_brokers(_gestor uuid)
 RETURNS TABLE(user_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT DISTINCT tm.user_id
  FROM public.team_members tm
  WHERE tm.status = 'ativo'
    AND tm.user_id IS NOT NULL
    AND (
      tm.gerente_id = _gestor
      OR tm.gerente_id IN (
        SELECT de.gerente_auth_id FROM public.diretoria_equipes de
        WHERE de.diretor_auth_id = _gestor
      )
    )
$function$;
GRANT EXECUTE ON FUNCTION public.resolve_managed_brokers(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_corretor_in_my_team(p_corretor_id uuid)
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.resolve_managed_brokers(auth.uid()) r
    WHERE r.user_id = p_corretor_id
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_lead_in_my_team(p_corretor_id uuid)
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.resolve_managed_brokers(auth.uid()) r
    WHERE r.user_id = p_corretor_id
  )
$function$;

CREATE OR REPLACE FUNCTION public.get_team_visitas(p_date_from text DEFAULT NULL::text, p_date_to text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, corretor_id uuid, corretor_nome text, nome_cliente text, empreendimento text, data_visita date, hora_visita text, local_visita text, status text, observacoes text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_team_ids uuid[];
  v_gerente uuid;
BEGIN
  SELECT array_agg(user_id) INTO v_team_ids FROM public.resolve_managed_brokers(auth.uid());
  IF v_team_ids IS NULL OR array_length(v_team_ids,1) IS NULL THEN
    SELECT tm.gerente_id INTO v_gerente
    FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.status='ativo' LIMIT 1;
    IF v_gerente IS NULL THEN RETURN; END IF;
    SELECT array_agg(user_id) INTO v_team_ids FROM public.resolve_managed_brokers(v_gerente);
  END IF;
  IF v_team_ids IS NULL OR array_length(v_team_ids,1) IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT v.id, v.corretor_id,
         COALESCE(p.nome,'Corretor') AS corretor_nome,
         v.nome_cliente, v.empreendimento, v.data_visita,
         v.hora_visita::text, v.local_visita, v.status, v.observacoes
  FROM visitas v
  LEFT JOIN profiles p ON p.user_id = v.corretor_id
  WHERE v.corretor_id = ANY(v_team_ids)
    AND v.corretor_id <> auth.uid()
    AND (p_date_from IS NULL OR v.data_visita >= p_date_from::date)
    AND (p_date_to IS NULL OR v.data_visita <= p_date_to::date)
  ORDER BY v.data_visita ASC, v.hora_visita ASC NULLS LAST;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_gerente_v4_kpis(p_gestor_id uuid, p_periodo text DEFAULT 'hoje'::text)
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

  IF p_periodo = 'hoje' THEN
    v_p_start := v_today;                        v_p_end    := v_today;
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

  SELECT array_agg(user_id) INTO v_team_auth
  FROM public.resolve_managed_brokers(p_gestor_id);
  IF v_team_auth IS NULL THEN v_team_auth := ARRAY[]::uuid[]; END IF;

  SELECT array_agg(id) INTO v_team_prof
  FROM profiles WHERE user_id = ANY(v_team_auth);
  IF v_team_prof IS NULL THEN v_team_prof := ARRAY[]::uuid[]; END IF;

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
  visitas_agendadas AS (
    SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead')
      AND status IN ('agendada','marcada','confirmada')
  ),
  visitas_total AS (
    SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead')
  ),
  negocios_ativos_total AS (
    SELECT COUNT(*)::int AS qtd FROM negocios
    WHERE corretor_id = ANY(v_team_prof)
      AND status = 'ativo'
      AND fase NOT IN ('vendido','distrato','perdido')
  ),
  tarefas_atr AS (
    SELECT pt.responsavel_id AS auth_id, COUNT(*)::int AS qtd
    FROM pipeline_tarefas pt
    WHERE pt.responsavel_id = ANY(v_team_auth)
      AND pt.status = 'pendente'
      AND (
        pt.vence_em < v_today
        OR (pt.vence_em = v_today
            AND COALESCE(pt.hora_vencimento, '23:59'::time)
                < (v_now AT TIME ZONE 'America/Sao_Paulo')::time)
      )
    GROUP BY pt.responsavel_id
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
    FROM (SELECT user_id FROM public.resolve_managed_brokers(p_gestor_id)) tm
    LEFT JOIN profiles p ON p.user_id = tm.user_id
    LEFT JOIN tarefas_atr ta ON ta.auth_id = tm.user_id
    LEFT JOIN leads_sem_acao ls ON ls.auth_id = tm.user_id
    WHERE true
  ),
  alertas_filtrados AS (
    SELECT * FROM alertas_raw
    ORDER BY score_soma DESC, nome ASC
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
      'visitas_total',            (SELECT qtd FROM visitas_total),
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
        'severity',            CASE
                                 WHEN a.score_soma >= 70 THEN 'critico'
                                 WHEN a.score_soma >= 40 THEN 'atencao'
                                 ELSE 'ok'
                               END
      ) ORDER BY a.score_soma DESC, a.nome ASC)
       FROM alertas_filtrados a),
      '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_gerente_v4_dia(p_gestor_id uuid, p_visitas_range text DEFAULT 'hoje'::text)
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

  v_turno_atual := CASE
    WHEN v_minutes_brt < (13*60 + 30) THEN 'manha'
    WHEN v_minutes_brt < (18*60 + 30) THEN 'tarde'
    ELSE 'noturna'
  END;

  IF p_visitas_range = 'semana' THEN
    v_v_start := date_trunc('week', v_today)::date;
    v_v_end   := (date_trunc('week', v_today) + INTERVAL '6 days')::date;
  ELSE
    v_v_start := v_today;
    v_v_end   := v_today;
  END IF;

  SELECT array_agg(user_id) INTO v_team_auth
  FROM public.resolve_managed_brokers(p_gestor_id);
  IF v_team_auth IS NULL THEN v_team_auth := ARRAY[]::uuid[]; END IF;

  SELECT array_agg(id) INTO v_team_prof
  FROM profiles WHERE user_id = ANY(v_team_auth);
  IF v_team_prof IS NULL THEN v_team_prof := ARRAY[]::uuid[]; END IF;

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

CREATE OR REPLACE FUNCTION public.get_dashboard_gerente(p_gestor_id uuid, p_periodo text DEFAULT 'mes'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_today date := (v_now)::date;
  v_p_start date;
  v_p_end   date;
  v_prev_start date;
  v_prev_end   date;
  v_mes_key text;
  v_meta record;
  v_kpis jsonb;
  v_corretores jsonb;
  v_team uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF auth.uid() <> p_gestor_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_periodo = 'hoje' THEN
    v_p_start := v_today; v_p_end := v_today;
    v_prev_start := v_today - INTERVAL '7 days'; v_prev_end := v_today - INTERVAL '7 days';
  ELSIF p_periodo = 'semana' THEN
    v_p_start := date_trunc('week', v_today)::date;
    v_p_end := (date_trunc('week', v_today) + INTERVAL '6 days')::date;
    v_prev_start := (date_trunc('week', v_today) - INTERVAL '7 days')::date;
    v_prev_end := (date_trunc('week', v_today) - INTERVAL '1 day')::date;
  ELSE
    v_p_start := date_trunc('month', v_today)::date;
    v_p_end := (date_trunc('month', v_today) + INTERVAL '1 month - 1 day')::date;
    v_prev_start := (date_trunc('month', v_today) - INTERVAL '1 month')::date;
    v_prev_end := (date_trunc('month', v_today) - INTERVAL '1 day')::date;
  END IF;

  v_mes_key := to_char(v_today, 'YYYY-MM');

  SELECT array_agg(user_id) INTO v_team
  FROM public.resolve_managed_brokers(p_gestor_id);
  IF v_team IS NULL THEN v_team := ARRAY[]::uuid[]; END IF;

  SELECT * INTO v_meta FROM ceo_metas_mensais
  WHERE gerente_id = p_gestor_id AND mes = v_mes_key LIMIT 1;
  IF v_meta IS NULL THEN
    v_meta.meta_vgv_assinado := 0;
    v_meta.meta_leads := 400;
    v_meta.meta_visitas_realizadas := 0;
    v_meta.meta_negocios := 90;
  END IF;

  WITH
  prof AS (SELECT id AS profile_id, user_id AS auth_id FROM profiles WHERE user_id = ANY(v_team)),
  vendas_atual AS (
    SELECT COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)), 0)::numeric AS v, COUNT(*)::int AS qtd
    FROM negocios n JOIN prof p ON p.profile_id = n.corretor_id
    WHERE n.data_assinatura BETWEEN v_p_start AND v_p_end
  ),
  vendas_prev AS (
    SELECT COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)), 0)::numeric AS v, COUNT(*)::int AS qtd
    FROM negocios n JOIN prof p ON p.profile_id = n.corretor_id
    WHERE n.data_assinatura BETWEEN v_prev_start AND v_prev_end
  ),
  leads_atual AS (
    SELECT COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_p_start AND v_p_end
  ),
  leads_prev AS (
    SELECT COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_prev_start AND v_prev_end
  ),
  visitas_atual AS (
    SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team) AND data_visita BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead')
  ),
  visitas_prev AS (
    SELECT COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team) AND data_visita BETWEEN v_prev_start AND v_prev_end
      AND (tipo IS NULL OR tipo = 'lead')
  ),
  negocios_ativos_total AS (
    SELECT COUNT(*)::int AS qtd FROM negocios n
    JOIN prof p ON p.profile_id = n.corretor_id
    WHERE n.status = 'ativo'
  )
  SELECT jsonb_build_object(
    'vendas',         (SELECT v FROM vendas_atual),
    'vendas_qtd',     (SELECT qtd FROM vendas_atual),
    'meta_vendas',    v_meta.meta_vgv_assinado,
    'leads',          (SELECT qtd FROM leads_atual),
    'meta_leads',     v_meta.meta_leads,
    'visitas',        (SELECT qtd FROM visitas_atual),
    'meta_visitas',   v_meta.meta_visitas_realizadas,
    'negocios',       (SELECT qtd FROM negocios_ativos_total),
    'meta_negocios',  v_meta.meta_negocios,
    'delta_vendas',   CASE WHEN (SELECT v FROM vendas_prev) = 0 THEN NULL
                           ELSE ROUND((((SELECT v FROM vendas_atual) - (SELECT v FROM vendas_prev)) / (SELECT v FROM vendas_prev)) * 100, 1) END,
    'delta_leads',    CASE WHEN (SELECT qtd FROM leads_prev) = 0 THEN NULL
                           ELSE ROUND((((SELECT qtd FROM leads_atual)::numeric - (SELECT qtd FROM leads_prev)) / (SELECT qtd FROM leads_prev)) * 100, 1) END,
    'delta_visitas',  CASE WHEN (SELECT qtd FROM visitas_prev) = 0 THEN NULL
                           ELSE ROUND((((SELECT qtd FROM visitas_atual)::numeric - (SELECT qtd FROM visitas_prev)) / (SELECT qtd FROM visitas_prev)) * 100, 1) END,
    'delta_negocios', NULL,
    'periodo',        p_periodo,
    'p_start',        v_p_start,
    'p_end',          v_p_end
  ) INTO v_kpis;

  WITH prof AS (
    SELECT id AS profile_id, user_id AS auth_id, nome, avatar_url
    FROM profiles WHERE user_id = ANY(v_team)
  ),
  vendas_c AS (
    SELECT p.auth_id, COALESCE(SUM(COALESCE(n.vgv_final, n.vgv_estimado, 0)),0)::numeric AS vgv
    FROM prof p
    LEFT JOIN negocios n ON n.corretor_id = p.profile_id
     AND n.data_assinatura BETWEEN v_p_start AND v_p_end
    GROUP BY p.auth_id
  ),
  leads_recebidos AS (
    SELECT corretor_id, COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team)
      AND (COALESCE(aceito_em, distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_p_start AND v_p_end
    GROUP BY corretor_id
  ),
  leads_ativos AS (
    SELECT corretor_id, COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team) AND COALESCE(arquivado, false) = false AND negocio_id IS NULL
    GROUP BY corretor_id
  ),
  leads_sem_acao AS (
    SELECT corretor_id, COUNT(*)::int AS qtd FROM pipeline_leads
    WHERE corretor_id = ANY(v_team) AND COALESCE(arquivado, false) = false AND negocio_id IS NULL
      AND COALESCE(ultima_acao_at, '1970-01-01'::timestamptz) < (now() - INTERVAL '30 days')
    GROUP BY corretor_id
  ),
  pipe_em_dia AS (
    SELECT corretor_id,
           COUNT(*) FILTER (WHERE COALESCE(ultima_acao_at, '1970-01-01'::timestamptz) >= (now() - INTERVAL '7 days'))::int AS em_dia,
           COUNT(*)::int AS total
    FROM pipeline_leads
    WHERE corretor_id = ANY(v_team) AND COALESCE(arquivado, false) = false AND negocio_id IS NULL
    GROUP BY corretor_id
  ),
  vis_marcadas AS (
    SELECT corretor_id, COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team) AND data_visita BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead') AND status IN ('marcada','confirmada','reagendada')
    GROUP BY corretor_id
  ),
  vis_realizadas AS (
    SELECT corretor_id, COUNT(*)::int AS qtd FROM visitas
    WHERE corretor_id = ANY(v_team) AND data_visita BETWEEN v_p_start AND v_p_end
      AND (tipo IS NULL OR tipo = 'lead') AND status = 'realizada'
    GROUP BY corretor_id
  ),
  negocios_ativos AS (
    SELECT p.auth_id, COUNT(*)::int AS qtd FROM prof p
    JOIN negocios n ON n.corretor_id = p.profile_id WHERE n.status = 'ativo'
    GROUP BY p.auth_id
  ),
  tarefas_atr AS (
    SELECT responsavel_id AS corretor_id, COUNT(*)::int AS qtd FROM pipeline_tarefas
    WHERE responsavel_id = ANY(v_team) AND status = 'pendente'
      AND (vence_em < v_today OR (vence_em = v_today AND COALESCE(hora_vencimento, '23:59:00'::time) < (v_now)::time))
    GROUP BY responsavel_id
  ),
  dias_alta AS (
    SELECT corretor_id, COUNT(DISTINCT d.dia)::int AS dias
    FROM (
      SELECT corretor_id, (ultima_acao_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia
      FROM pipeline_leads
      WHERE corretor_id = ANY(v_team) AND ultima_acao_at >= (now() - INTERVAL '14 days')
      UNION
      SELECT v.corretor_id, v.data_visita FROM visitas v
      WHERE v.corretor_id = ANY(v_team) AND v.data_visita >= (v_today - INTERVAL '14 days')::date
    ) d GROUP BY corretor_id
  ),
  base AS (
    SELECT p.auth_id AS user_id, p.nome, p.avatar_url,
      COALESCE(v.vgv, 0)::numeric AS vendas_vgv,
      COALESCE(lr.qtd, 0) AS leads_recebidos,
      COALESCE(la.qtd, 0) AS leads_ativos,
      COALESCE(lsa.qtd, 0) AS leads_sem_acao_30d,
      COALESCE(ped.em_dia, 0) AS pipe_em_dia,
      COALESCE(ped.total, 0) AS pipe_total,
      COALESCE(vm.qtd, 0) AS visitas_marcadas,
      COALESCE(vr.qtd, 0) AS visitas_realizadas,
      COALESCE(na.qtd, 0) AS negocios_ativos,
      COALESCE(na.qtd, 0) AS negocios,
      COALESCE(ta.qtd, 0) AS tarefas_atrasadas,
      COALESCE(da.dias, 0) AS dias_em_alta,
      COALESCE(lr.qtd, 0) AS leads_total
    FROM prof p
    LEFT JOIN vendas_c v        ON v.auth_id = p.auth_id
    LEFT JOIN leads_recebidos lr ON lr.corretor_id = p.auth_id
    LEFT JOIN leads_ativos la    ON la.corretor_id = p.auth_id
    LEFT JOIN leads_sem_acao lsa ON lsa.corretor_id = p.auth_id
    LEFT JOIN pipe_em_dia ped    ON ped.corretor_id = p.auth_id
    LEFT JOIN vis_marcadas vm    ON vm.corretor_id = p.auth_id
    LEFT JOIN vis_realizadas vr  ON vr.corretor_id = p.auth_id
    LEFT JOIN negocios_ativos na ON na.auth_id = p.auth_id
    LEFT JOIN tarefas_atr ta     ON ta.corretor_id = p.auth_id
    LEFT JOIN dias_alta da       ON da.corretor_id = p.auth_id
  ),
  stats AS (
    SELECT AVG(vendas_vgv) AS mu, COALESCE(NULLIF(STDDEV_POP(vendas_vgv),0), 1) AS sigma FROM base
  ),
  scored AS (
    SELECT b.*,
      CASE
        WHEN b.tarefas_atrasadas >= 25 THEN 'critico'
        WHEN b.dias_em_alta >= 3 THEN 'em_alta'
        WHEN (b.vendas_vgv - (SELECT mu FROM stats)) / (SELECT sigma FROM stats) >= 0.84 THEN 'top'
        WHEN (b.vendas_vgv - (SELECT mu FROM stats)) / (SELECT sigma FROM stats) <= -1.28 THEN 'atencao'
        ELSE 'ok'
      END AS status,
      CASE
        WHEN b.leads_sem_acao_30d >= 20 THEN b.leads_sem_acao_30d::text || ' leads sem ação há 30d+'
        WHEN b.tarefas_atrasadas >= 25 THEN b.tarefas_atrasadas::text || ' tarefas atrasadas'
        WHEN b.leads_ativos > GREATEST(b.leads_recebidos, 1) * 1.5 THEN 'Carteira sobrecarregada'
        WHEN b.dias_em_alta >= 5 THEN 'Em alta há ' || b.dias_em_alta::text || ' dias'
        ELSE NULL
      END AS meta_line
    FROM base b
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(scored) ORDER BY vendas_vgv DESC, negocios_ativos DESC), '[]'::jsonb)
    INTO v_corretores FROM scored;

  RETURN jsonb_build_object(
    'kpis_top',   v_kpis,
    'corretores', v_corretores,
    'meta_id',    (SELECT id FROM ceo_metas_mensais WHERE gerente_id = p_gestor_id AND mes = v_mes_key LIMIT 1),
    'mes_key',    v_mes_key
  );
END;
$function$;