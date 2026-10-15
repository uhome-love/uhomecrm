CREATE OR REPLACE FUNCTION public.roleta_apto_janela(p_auth_user_id uuid, p_janela text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_seg_atual date;
  v_domingo boolean;
BEGIN
  IF NOT public.roleta_crm_gate_ativo() THEN RETURN true; END IF;
  IF NOT public.roleta_crm_apto(p_auth_user_id) THEN RETURN false; END IF;
  v_seg_atual := v_hoje - ((EXTRACT(ISODOW FROM v_hoje)::int) - 1);
  v_domingo := EXTRACT(ISODOW FROM v_hoje) = 7;

  IF v_domingo AND COALESCE(p_janela,'') IN ('dia_todo','domingo','') THEN
    -- Domingo: 2 visitas realizadas de segunda a sábado
    RETURN public.roleta_visitas_realizadas_periodo(p_auth_user_id, v_seg_atual, v_hoje - 1) >= public.roleta_visitas_meta();
  END IF;

  IF COALESCE(p_janela,'') = 'noturna' AND NOT public.roleta_tem_visita_hoje(p_auth_user_id) THEN
    RETURN false;
  END IF;

  IF public.roleta_visitas_gate_ativo()
     AND public.roleta_visitas_realizadas_periodo(p_auth_user_id, v_seg_atual - 7, v_seg_atual - 1) < public.roleta_visitas_meta()
     AND public.roleta_visitas_realizadas_periodo(p_auth_user_id, v_seg_atual, v_hoje) < public.roleta_visitas_meta() THEN
    RETURN false;
  END IF;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END;
$function$;

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
  v_saude JSONB; v_min NUMERIC; v_meta INT := public.roleta_visitas_meta(); v_vis INT; v_vis_atual INT;
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
          'texto', format('A Roleta de domingo exige %s visitas realizadas de segunda a sábado. Você tem %s.', v_meta, v_vis),
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
          'texto', format('A Roleta exige %s visitas realizadas na semana anterior. Você teve %s. Esta semana você tem %s: ao completar %s, libera na hora (com CRM em dia).', v_meta, v_vis, v_vis_atual, v_meta),
          'visitas', v_vis, 'visitas_atual', v_vis_atual, 'meta', v_meta);
      END IF;
    END IF;
    RETURN jsonb_build_object('bloqueado', false, 'codigo', 'ok', 'titulo', 'Elegível', 'texto', 'Você está apto a se credenciar.');
  END IF;

  -- Regra antiga (chave desligada) — inalterada
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