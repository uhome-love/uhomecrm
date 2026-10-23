ALTER TABLE public.roleta_fechamento_semanal ADD COLUMN IF NOT EXISTS visitas_pontos numeric;

CREATE OR REPLACE FUNCTION public.roleta_fmt_visitas(p numeric)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$ SELECT replace(trim_scale(round(COALESCE(p,0),1))::text, '.', ',') $$;

DROP FUNCTION IF EXISTS public.rpc_performance_roleta();
DROP FUNCTION IF EXISTS public.roleta_visitas_realizadas_periodo(uuid, date, date);

-- Visitas válidas da Roleta: 1 por cliente no período; cliente com parceria ativa
-- (com outro corretor, em que o corretor da visita participa) vale 0,5 para cada lado.
CREATE FUNCTION public.roleta_visitas_realizadas_periodo(p_auth_user_id uuid, p_inicio date, p_fim date)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH v AS (
    SELECT COALESCE(v.pipeline_lead_id::text, v.id::text) AS cli, v.pipeline_lead_id, v.data_visita,
           COALESCE((SELECT p.user_id FROM public.profiles p WHERE p.id = v.corretor_id), v.corretor_id) AS dono
    FROM public.visitas v
    WHERE v.status = 'realizada' AND v.data_visita::date BETWEEN p_inicio AND p_fim
  ), vp AS (
    SELECT v.cli, v.dono, pp.pri, pp.parc
    FROM v
    LEFT JOIN LATERAL (
      SELECT x.pri, x.parc FROM (
        SELECT COALESCE(a.user_id, z.corretor_principal_id) AS pri,
               COALESCE(b.user_id, z.corretor_parceiro_id) AS parc, z.created_at
        FROM public.pipeline_parcerias z
        LEFT JOIN public.profiles a ON a.id = z.corretor_principal_id
        LEFT JOIN public.profiles b ON b.id = z.corretor_parceiro_id
        WHERE z.pipeline_lead_id = v.pipeline_lead_id AND z.status = 'ativa'
      ) x
      WHERE x.pri <> x.parc AND v.dono IN (x.pri, x.parc)
      ORDER BY abs(extract(epoch FROM (x.created_at - v.data_visita::timestamp))) LIMIT 1
    ) pp ON true
  ), w AS (
    SELECT cli, CASE WHEN pri IS NULL THEN 1.0 ELSE 0.5 END AS peso
    FROM vp
    WHERE (pri IS NULL AND dono = p_auth_user_id) OR (pri IS NOT NULL AND p_auth_user_id IN (pri, parc))
  )
  SELECT COALESCE(sum(peso), 0)::numeric FROM (SELECT cli, max(peso) AS peso FROM w GROUP BY cli) t;
$function$;
GRANT EXECUTE ON FUNCTION public.roleta_visitas_realizadas_periodo(uuid, date, date) TO authenticated, service_role;

CREATE FUNCTION public.rpc_performance_roleta()
 RETURNS TABLE(user_id uuid, nome text, equipe text, gerente_id uuid, crm jsonb, motivo jsonb, visitas_semana_passada numeric, visitas_semana_atual numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_all boolean;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_seg date := date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  v_all := public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor');
  IF NOT v_all AND NOT public.has_role(v_uid,'gestor') THEN RETURN; END IF;
  RETURN QUERY
  SELECT t.user_id, t.nome::text, t.equipe::text, t.gerente_id,
         public.crm_saude_corretor(t.user_id),
         public.roleta_motivo_bloqueio(t.user_id, 'manha'),
         public.roleta_visitas_realizadas_periodo(t.user_id, v_seg - 7, v_seg - 1),
         public.roleta_visitas_realizadas_periodo(t.user_id, v_seg, v_hoje)
  FROM public.team_members t
  WHERE t.status = 'ativo' AND t.user_id IS NOT NULL
    AND (v_all OR t.gerente_id = v_uid);
END $function$;
GRANT EXECUTE ON FUNCTION public.rpc_performance_roleta() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.roleta_motivo_bloqueio(p_auth_user_id uuid, p_janela text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_limite_vermelhos INTEGER; v_so_noturna BOOLEAN; v_limite_descartes INTEGER; v_descartes_mes INTEGER;
  v_desbloqueio BOOLEAN; v_vermelhos INTEGER; v_noturna_exige BOOLEAN; v_profile_id UUID;
  v_today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_seg DATE; v_manha BOOLEAN := TRUE; v_tarde BOOLEAN := TRUE;
  v_gate BOOLEAN := public.roleta_crm_gate_ativo();
  v_saude JSONB; v_min NUMERIC; v_meta INT := public.roleta_visitas_meta(); v_vis NUMERIC; v_vis_atual NUMERIC;
BEGIN
  v_seg := v_today - ((EXTRACT(ISODOW FROM v_today)::int) - 1);
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_leads_desatualizados'), 10) INTO v_limite_vermelhos;
  SELECT COALESCE((SELECT valor::BOOLEAN FROM public.roleta_config WHERE chave = 'limite_vermelhos_apenas_noturna'), true) INTO v_so_noturna;
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_descartes_mes'), 100) INTO v_limite_descartes;
  SELECT COALESCE((SELECT valor::BOOLEAN FROM public.roleta_config WHERE chave = 'noturna_exige_manha_tarde'), true) INTO v_noturna_exige;
  SELECT COUNT(*)::INTEGER INTO v_descartes_mes
  FROM public.pipeline_leads pl JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(public.resolve_corretor_scope_ids(p_auth_user_id))
    AND COALESCE(ps.tipo::text, '') = 'descarte'
    AND pl.stage_changed_at >= date_trunc('month', CURRENT_DATE)
    AND pl.stage_changed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';
  SELECT EXISTS (SELECT 1 FROM public.roleta_desbloqueios WHERE corretor_id = p_auth_user_id AND mes = to_char(CURRENT_DATE, 'YYYY-MM')) INTO v_desbloqueio;
  IF v_descartes_mes >= v_limite_descartes AND NOT v_desbloqueio THEN
    RETURN jsonb_build_object('bloqueado', true, 'codigo', 'descartes', 'titulo', 'Teto de descartes do mês atingido',
      'texto', format('Você descartou %s leads este mês (limite: %s). A liberação depende do seu gestor; o contador zera no início do próximo mês.', v_descartes_mes, v_limite_descartes),
      'descartes_mes', v_descartes_mes, 'limite_descartes', v_limite_descartes);
  END IF;

  IF v_gate THEN
    IF NOT public.roleta_crm_apto(p_auth_user_id) THEN
      v_saude := public.crm_saude_corretor(p_auth_user_id);
      v_min := public.roleta_crm_minimo_pct();
      RETURN jsonb_build_object('bloqueado', true, 'codigo', 'crm', 'titulo', 'Sua Roleta está temporariamente bloqueada',
        'texto', format('Seu CRM está em %s%% e o mínimo exigido é %s%%. Atualize seus clientes (%s precisam de atualização). Ao chegar a %s%%, você recupera o acesso e precisa se credenciar novamente no próximo horário disponível.',
                        to_char(round((v_saude->>'pct')::numeric,1),'FM990D0'), v_min::text, COALESCE(v_saude->>'a_atualizar','0'), v_min::text),
        'pct', round((v_saude->>'pct')::numeric,1), 'minimo', v_min, 'a_atualizar', v_saude->'a_atualizar');
    END IF;
    IF EXTRACT(ISODOW FROM v_today) = 7 AND COALESCE(p_janela,'') IN ('dia_todo','domingo','') THEN
      v_vis := public.roleta_visitas_realizadas_periodo(p_auth_user_id, v_seg, v_today - 1);
      IF v_vis < v_meta THEN
        RETURN jsonb_build_object('bloqueado', true, 'codigo', 'visitas_semana', 'titulo', 'Visitas da semana insuficientes',
          'texto', format('A Roleta de domingo exige %s visitas realizadas de segunda a sábado. Você tem %s.', v_meta, public.roleta_fmt_visitas(v_vis)),
          'visitas', v_vis, 'meta', v_meta);
      END IF;
      RETURN jsonb_build_object('bloqueado', false, 'codigo', 'ok', 'titulo', 'Elegível', 'texto', 'Você está apto a se credenciar.');
    END IF;
    IF COALESCE(p_janela,'') = 'noturna' AND NOT public.roleta_tem_visita_hoje(p_auth_user_id) THEN
      RETURN jsonb_build_object('bloqueado', true, 'codigo', 'sem_visita_hoje', 'titulo', 'Sem visita hoje',
        'texto', 'Para a Roleta da noite você precisa de 1 visita marcada ou realizada hoje.');
    END IF;
    IF public.roleta_visitas_gate_ativo() THEN
      v_vis := public.roleta_visitas_realizadas_periodo(p_auth_user_id, v_seg - 7, v_seg - 1);
      v_vis_atual := public.roleta_visitas_realizadas_periodo(p_auth_user_id, v_seg, v_today);
      IF v_vis < v_meta AND v_vis_atual < v_meta THEN
        RETURN jsonb_build_object('bloqueado', true, 'codigo', 'visitas_semana', 'titulo', 'Meta de visitas da semana anterior',
          'texto', format('A Roleta exige %s visitas realizadas na semana anterior. Você teve %s. Esta semana você tem %s: ao completar %s, libera na hora (com CRM em dia). Visita em parceria conta 0,5.', v_meta, public.roleta_fmt_visitas(v_vis), public.roleta_fmt_visitas(v_vis_atual), v_meta),
          'visitas', v_vis, 'visitas_atual', v_vis_atual, 'meta', v_meta);
      END IF;
    END IF;
    RETURN jsonb_build_object('bloqueado', false, 'codigo', 'ok', 'titulo', 'Elegível', 'texto', 'Você está apto a se credenciar.');
  END IF;

  IF (NOT v_so_noturna) OR COALESCE(p_janela, '') = 'noturna' THEN
    v_vermelhos := public.contar_leads_vermelhos(p_auth_user_id);
    IF v_vermelhos > v_limite_vermelhos THEN
      RETURN jsonb_build_object('bloqueado', true, 'codigo', 'vermelhos', 'titulo', 'Leads vermelhos acima do limite',
        'texto', format('Você tem %s leads vermelhos (limite: %s). Atualize pelo menos %s para liberar.', v_vermelhos, v_limite_vermelhos, v_vermelhos - v_limite_vermelhos),
        'vermelhos', v_vermelhos, 'limite_vermelhos', v_limite_vermelhos);
    END IF;
  END IF;
  IF COALESCE(p_janela, '') = 'noturna' THEN
    IF NOT public.roleta_tem_visita_hoje(p_auth_user_id) THEN
      RETURN jsonb_build_object('bloqueado', true, 'codigo', 'sem_visita_hoje', 'titulo', 'Sem visita registrada hoje',
        'texto', 'A roleta noturna exige uma visita marcada ou realizada registrada hoje no pipeline.');
    END IF;
    IF v_noturna_exige THEN
      SELECT p.id INTO v_profile_id FROM public.profiles p WHERE p.user_id = p_auth_user_id;
      SELECT
        EXISTS(SELECT 1 FROM public.roleta_presencas rp WHERE rp.corretor_id = v_profile_id AND rp.data = v_today AND rp.turno = 'manha' AND rp.status IN ('na_empresa','saiu')),
        EXISTS(SELECT 1 FROM public.roleta_presencas rp WHERE rp.corretor_id = v_profile_id AND rp.data = v_today AND rp.turno = 'tarde' AND rp.status IN ('na_empresa','saiu'))
      INTO v_manha, v_tarde;
      IF NOT (v_manha AND v_tarde) THEN
        RETURN jsonb_build_object('bloqueado', true, 'codigo', 'presenca', 'titulo', 'Presença do dia não validada',
          'texto', format('A noturna libera após o gestor confirmar sua presença na manhã (%s) e na tarde (%s).',
                          CASE WHEN v_manha THEN 'ok' ELSE 'pendente' END, CASE WHEN v_tarde THEN 'ok' ELSE 'pendente' END),
          'presente_manha', v_manha, 'presente_tarde', v_tarde);
      END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object('bloqueado', false, 'codigo', 'ok', 'titulo', 'Elegível', 'texto', 'Você está apto a se credenciar.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.roleta_fechar_semana(p_semana_inicio date DEFAULT NULL::date, p_notificar boolean DEFAULT true)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ini date; v_fim date; v_meta int := public.roleta_visitas_meta();
  r record; v_vis numeric; v_pct numeric; v_sit text; v_n int := 0; g record; v_label text;
BEGIN
  v_ini := COALESCE(p_semana_inicio, v_hoje - ((EXTRACT(ISODOW FROM v_hoje)::int) - 1) - 7);
  v_fim := v_ini + 6;
  v_label := to_char(v_ini,'DD') || '–' || to_char(v_fim,'DD/MM');
  FOR r IN SELECT DISTINCT ON (tm.user_id) tm.user_id, tm.gerente_id FROM public.team_members tm
           WHERE tm.status = 'ativo' AND tm.user_id IS NOT NULL AND tm.user_id <> tm.gerente_id
           ORDER BY tm.user_id, tm.updated_at DESC LOOP
    BEGIN
      v_vis := COALESCE(public.roleta_visitas_realizadas_periodo(r.user_id, v_ini, v_fim), 0);
      v_pct := (public.crm_saude_corretor(r.user_id)->>'pct')::numeric;
      v_sit := CASE WHEN v_vis >= v_meta THEN 'apto' WHEN v_vis > 0 THEN 'evolucao' ELSE 'retomada' END;
      INSERT INTO public.roleta_fechamento_semanal (semana_inicio, corretor_id, gerente_id, visitas_validas, visitas_pontos, crm_pct, situacao, um_a_um_pendente)
      VALUES (v_ini, r.user_id, r.gerente_id, floor(v_vis)::int, v_vis, round(v_pct,1), v_sit, v_sit = 'retomada')
      ON CONFLICT (semana_inicio, corretor_id) DO NOTHING;
      IF FOUND THEN
        v_n := v_n + 1;
        IF p_notificar THEN
          PERFORM public.criar_notificacao(r.user_id, 'performance', 'fechamento_semanal',
            '📊 Fechamento da semana ' || v_label,
            'Você fez ' || public.roleta_fmt_visitas(v_vis) || ' visita' || CASE WHEN v_vis = 1 THEN '' ELSE 's' END || ' válida' || CASE WHEN v_vis = 1 THEN '' ELSE 's' END || '. Situação: ' ||
              CASE v_sit WHEN 'apto' THEN 'Apto' WHEN 'evolucao' THEN 'Em evolução' ELSE 'Plano de retomada' END || '.',
            jsonb_build_object('semana_inicio', v_ini, 'situacao', v_sit, 'visitas', v_vis),
            'fechamento_' || v_ini::text || '_' || r.user_id::text);
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  IF p_notificar THEN
    FOR g IN SELECT gerente_id, count(*) FILTER (WHERE situacao='apto') a, count(*) FILTER (WHERE situacao='evolucao') e, count(*) FILTER (WHERE situacao='retomada') rt
             FROM public.roleta_fechamento_semanal WHERE semana_inicio = v_ini AND gerente_id IS NOT NULL GROUP BY gerente_id LOOP
      BEGIN
        PERFORM public.criar_notificacao(g.gerente_id, 'performance', 'fechamento_semanal_equipe',
          '📊 Fechamento da semana ' || v_label,
          g.a || ' aptos, ' || g.e || ' em evolução, ' || g.rt || ' em plano de retomada (1:1 obrigatório).',
          jsonb_build_object('semana_inicio', v_ini),
          'fechamento_equipe_' || v_ini::text || '_' || g.gerente_id::text);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  END IF;
  RETURN v_n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.roleta_tem_visita_hoje(p_auth_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.pipeline_atividades pa
    WHERE pa.responsavel_id = p_auth_user_id
      AND pa.tipo IN ('visita_agendada','visita_realizada')
      AND (pa.created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ) OR EXISTS (
    SELECT 1 FROM public.visitas v
    WHERE (
        v.corretor_id = p_auth_user_id
        OR v.corretor_id IN (SELECT id FROM public.profiles WHERE user_id = p_auth_user_id)
        OR EXISTS (
          SELECT 1 FROM public.pipeline_parcerias z
          WHERE z.pipeline_lead_id = v.pipeline_lead_id AND z.status = 'ativa'
            AND z.corretor_principal_id <> z.corretor_parceiro_id
            AND p_auth_user_id IN (z.corretor_principal_id, z.corretor_parceiro_id)
        )
      )
      AND (
        ((v.created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
          AND v.status NOT IN ('cancelada','reagendada'))
        OR
        (v.data_visita::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
          AND v.status IN ('marcada','confirmada','realizada'))
      )
  );
$function$;

DROP POLICY IF EXISTS "Managers can update partnerships" ON public.pipeline_parcerias;
DROP POLICY IF EXISTS "Managers can delete partnerships" ON public.pipeline_parcerias;
CREATE POLICY "Only admin can update partnerships" ON public.pipeline_parcerias
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admin can delete partnerships" ON public.pipeline_parcerias
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));