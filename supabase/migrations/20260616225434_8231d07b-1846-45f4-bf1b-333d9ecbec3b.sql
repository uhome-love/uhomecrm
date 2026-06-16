-- 1. can_access_negocio: incluir escopo de diretoria via resolve_managed_brokers
CREATE OR REPLACE FUNCTION public.can_access_negocio(p_negocio_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.negocios n
    WHERE n.id = p_negocio_id
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR n.auth_user_id = auth.uid()
        OR n.gerente_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        OR n.corretor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        -- corretores das equipes que o usuário gerencia (inclui diretoria)
        OR n.corretor_id IN (
          SELECT p.id FROM public.profiles p
          WHERE p.user_id IN (
            SELECT user_id FROM public.resolve_managed_brokers(auth.uid())
          )
        )
      )
  )
$function$;

-- 2. negocios_select_scoped: trocar o filtro de equipe direta por resolve_managed_brokers
DROP POLICY IF EXISTS negocios_select_scoped ON public.negocios;
CREATE POLICY negocios_select_scoped ON public.negocios
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (auth_user_id = auth.uid())
  OR (gerente_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
  OR (corretor_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
  -- corretores das equipes geridas (inclui diretoria de múltiplas equipes)
  OR (corretor_id IN (
    SELECT p.id FROM profiles p
    WHERE p.user_id IN (SELECT user_id FROM public.resolve_managed_brokers(auth.uid()))
  ))
  OR (EXISTS (
    SELECT 1 FROM pipeline_parcerias pp
    WHERE pp.pipeline_lead_id = negocios.pipeline_lead_id
      AND pp.status = 'ativa'::text
      AND (pp.corretor_principal_id = auth.uid() OR pp.corretor_parceiro_id = auth.uid())
  ))
);

-- 3. get_dashboard_gerente_v4_dia: incluir negócios com gerente_id do gestor no mini pipeline
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
  v_gestor_prof   uuid;
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

  SELECT id INTO v_gestor_prof FROM profiles WHERE user_id = p_gestor_id LIMIT 1;

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
    WHERE (n.corretor_id = ANY(v_team_prof) OR n.gerente_id = v_gestor_prof)
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
      WHERE (n.corretor_id = ANY(v_team_prof) OR n.gerente_id = v_gestor_prof)
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
    'mini_pipeline', COALESCE(v_pipeline, '[]'::jsonb),
    'roleta',        v_roleta
  );
END;
$function$;