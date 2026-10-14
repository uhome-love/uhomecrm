-- Uhome Performance Fase 0: CRM 80% gate (desligado por padrão)

CREATE TABLE IF NOT EXISTS public.roleta_config_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL,
  valor_anterior text,
  valor_novo text,
  alterado_por uuid,
  justificativa text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roleta_config_auditoria TO authenticated;
GRANT ALL ON public.roleta_config_auditoria TO service_role;
ALTER TABLE public.roleta_config_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Direcao le auditoria roleta" ON public.roleta_config_auditoria
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

CREATE OR REPLACE FUNCTION public.trg_roleta_config_auditoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.roleta_config_auditoria(chave, valor_anterior, valor_novo, alterado_por, justificativa)
    VALUES (NEW.chave, NULL, NEW.valor, auth.uid(), NEW.descricao);
  ELSIF NEW.valor IS DISTINCT FROM OLD.valor THEN
    INSERT INTO public.roleta_config_auditoria(chave, valor_anterior, valor_novo, alterado_por, justificativa)
    VALUES (NEW.chave, OLD.valor, NEW.valor, auth.uid(), NEW.descricao);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS roleta_config_auditoria_trg ON public.roleta_config;
CREATE TRIGGER roleta_config_auditoria_trg AFTER INSERT OR UPDATE ON public.roleta_config
  FOR EACH ROW EXECUTE FUNCTION public.trg_roleta_config_auditoria();

-- Saúde do CRM por corretor: mesma régua de rpc_carteira_saude
CREATE OR REPLACE FUNCTION public.crm_saude_corretor(p_auth_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT count(*) AS total,
         count(*) FILTER (WHERE saude <> 'estagnado') AS ativos,
         count(*) FILTER (WHERE saude = 'verde') AS em_dia,
         count(*) FILTER (WHERE saude IN ('ambar','vermelho')) AS a_atualizar,
         count(*) FILTER (WHERE saude = 'estagnado') AS estagnado
    INTO r
  FROM (
    SELECT public.lead_saude_status(pl.ultimo_toque_at, COALESCE(pl.distribuido_em, pl.created_at), st.tipo, pl.estagnacao_carencia_ate) AS saude
    FROM public.pipeline_leads pl
    JOIN public.pipeline_stages st ON st.id = pl.stage_id
    WHERE COALESCE(pl.arquivado,false) = false AND st.pipeline_tipo = 'leads'
      AND st.tipo NOT IN ('venda','caiu','descarte','convertido')
      AND pl.corretor_id = p_auth_user_id
  ) b;

  IF r.total = 0 THEN
    RETURN jsonb_build_object('estado','sem_carteira','pct',NULL,'total',0,'ativos',0,'em_dia',0,'a_atualizar',0,'estagnado',0);
  ELSIF r.ativos = 0 THEN
    RETURN jsonb_build_object('estado','dados_insuficientes','pct',NULL,'total',r.total,'ativos',0,'em_dia',0,'a_atualizar',0,'estagnado',r.estagnado);
  END IF;
  RETURN jsonb_build_object('estado','calculado',
    'pct', 100.0 * r.em_dia / r.ativos,
    'total', r.total, 'ativos', r.ativos, 'em_dia', r.em_dia,
    'a_atualizar', r.a_atualizar, 'estagnado', r.estagnado);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('estado','erro','pct',NULL,'erro',SQLERRM);
END $$;

CREATE OR REPLACE FUNCTION public.roleta_crm_gate_ativo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT lower(valor) = 'true' FROM public.roleta_config WHERE chave = 'crm_gate_ativo'), false)
$$;

CREATE OR REPLACE FUNCTION public.roleta_crm_minimo_pct()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT NULLIF(valor,'')::numeric FROM public.roleta_config WHERE chave = 'crm_minimo_pct'), 80)
$$;

-- Fonte única: corretor apto pelo critério de CRM? (true se a chave estiver desligada)
CREATE OR REPLACE FUNCTION public.roleta_crm_apto(p_auth_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb;
BEGIN
  IF NOT public.roleta_crm_gate_ativo() THEN RETURN true; END IF;
  s := public.crm_saude_corretor(p_auth_user_id);
  IF s->>'estado' <> 'calculado' THEN RETURN true; END IF;
  RETURN (s->>'pct')::numeric >= public.roleta_crm_minimo_pct();
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END $$;

-- Status para a tela do corretor
CREATE OR REPLACE FUNCTION public.roleta_performance_status(p_auth_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user uuid := COALESCE(p_auth_user_id, auth.uid());
  s jsonb; v_min numeric; v_gate boolean; v_apto boolean; v_motivos jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '{}'::jsonb; END IF;
  IF v_user <> v_uid AND NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor') OR public.has_role(v_uid,'gestor')) THEN
    v_user := v_uid;
  END IF;
  s := public.crm_saude_corretor(v_user);
  v_min := public.roleta_crm_minimo_pct();
  v_gate := public.roleta_crm_gate_ativo();
  v_apto := s->>'estado' <> 'calculado' OR (s->>'pct')::numeric >= v_min;
  IF NOT v_apto THEN
    v_motivos := v_motivos || jsonb_build_array(jsonb_build_object(
      'codigo','crm','pct', round((s->>'pct')::numeric,1),'minimo', v_min,'a_atualizar', s->'a_atualizar'));
  END IF;
  RETURN jsonb_build_object(
    'crm', s, 'crm_minimo_pct', v_min,
    'crm_gate_ativo', v_gate,
    'visitas_gate_ativo', COALESCE((SELECT lower(valor)='true' FROM public.roleta_config WHERE chave='visitas_gate_ativo'), false),
    'crm_atende', v_apto,
    'bloqueado', v_gate AND NOT v_apto,
    'motivos', v_motivos);
END $$;

GRANT EXECUTE ON FUNCTION public.roleta_performance_status(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_saude_corretor(uuid) FROM anon;

-- Credenciamento: com a chave do CRM ligada, troca a regra dos vermelhos pelo CRM mínimo
CREATE OR REPLACE FUNCTION public.corretor_pode_entrar_roleta(p_corretor_id uuid, p_janela text DEFAULT NULL::text)
 RETURNS boolean LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE
  v_vermelhos        INTEGER;
  v_limite_vermelhos INTEGER;
  v_so_noturna       BOOLEAN;
  v_limite_descartes INTEGER;
  v_descartes_mes    INTEGER;
  v_desbloqueio      BOOLEAN;
BEGIN
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_leads_desatualizados'), 10) INTO v_limite_vermelhos;
  SELECT COALESCE((SELECT valor::BOOLEAN FROM public.roleta_config WHERE chave = 'limite_vermelhos_apenas_noturna'), true) INTO v_so_noturna;
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_descartes_mes'), 100) INTO v_limite_descartes;

  SELECT COUNT(*)::INTEGER INTO v_descartes_mes
  FROM public.pipeline_leads pl
  JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(public.resolve_corretor_scope_ids(p_corretor_id))
    AND COALESCE(ps.tipo::text, '') = 'descarte'
    AND pl.stage_changed_at >= date_trunc('month', CURRENT_DATE)
    AND pl.stage_changed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

  SELECT EXISTS (SELECT 1 FROM public.roleta_desbloqueios WHERE corretor_id = p_corretor_id AND mes = to_char(CURRENT_DATE, 'YYYY-MM')) INTO v_desbloqueio;

  IF v_descartes_mes >= v_limite_descartes AND NOT v_desbloqueio THEN
    RETURN FALSE;
  END IF;

  IF public.roleta_crm_gate_ativo() THEN
    RETURN public.roleta_crm_apto(p_corretor_id);
  END IF;

  IF (NOT v_so_noturna) OR COALESCE(p_janela, '') = 'noturna' THEN
    v_vermelhos := public.contar_leads_vermelhos(p_corretor_id);
    IF v_vermelhos > v_limite_vermelhos THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$function$;

-- Motivo do bloqueio: inclui CRM com dado atual, meta e caminho
CREATE OR REPLACE FUNCTION public.roleta_motivo_bloqueio(p_auth_user_id uuid, p_janela text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE
  v_limite_vermelhos INTEGER;
  v_so_noturna       BOOLEAN;
  v_limite_descartes INTEGER;
  v_descartes_mes    INTEGER;
  v_desbloqueio      BOOLEAN;
  v_vermelhos        INTEGER;
  v_tem_visita_hoje  BOOLEAN;
  v_noturna_exige    BOOLEAN;
  v_profile_id       UUID;
  v_today            DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_manha            BOOLEAN := TRUE;
  v_tarde            BOOLEAN := TRUE;
  v_gate             BOOLEAN := public.roleta_crm_gate_ativo();
  v_saude            JSONB;
  v_min              NUMERIC;
BEGIN
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_leads_desatualizados'), 10) INTO v_limite_vermelhos;
  SELECT COALESCE((SELECT valor::BOOLEAN FROM public.roleta_config WHERE chave = 'limite_vermelhos_apenas_noturna'), true) INTO v_so_noturna;
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_descartes_mes'), 100) INTO v_limite_descartes;
  SELECT COALESCE((SELECT valor::BOOLEAN FROM public.roleta_config WHERE chave = 'noturna_exige_manha_tarde'), true) INTO v_noturna_exige;

  SELECT COUNT(*)::INTEGER INTO v_descartes_mes
  FROM public.pipeline_leads pl
  JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(public.resolve_corretor_scope_ids(p_auth_user_id))
    AND COALESCE(ps.tipo::text, '') = 'descarte'
    AND pl.stage_changed_at >= date_trunc('month', CURRENT_DATE)
    AND pl.stage_changed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

  SELECT EXISTS (SELECT 1 FROM public.roleta_desbloqueios WHERE corretor_id = p_auth_user_id AND mes = to_char(CURRENT_DATE, 'YYYY-MM')) INTO v_desbloqueio;

  IF v_descartes_mes >= v_limite_descartes AND NOT v_desbloqueio THEN
    RETURN jsonb_build_object(
      'bloqueado', true, 'codigo', 'descartes',
      'titulo', 'Teto de descartes do mês atingido',
      'texto', format('Você descartou %s leads este mês (limite: %s). A liberação depende do seu gestor; o contador zera no início do próximo mês.', v_descartes_mes, v_limite_descartes),
      'descartes_mes', v_descartes_mes, 'limite_descartes', v_limite_descartes);
  END IF;

  IF v_gate THEN
    IF NOT public.roleta_crm_apto(p_auth_user_id) THEN
      v_saude := public.crm_saude_corretor(p_auth_user_id);
      v_min := public.roleta_crm_minimo_pct();
      RETURN jsonb_build_object(
        'bloqueado', true, 'codigo', 'crm',
        'titulo', 'Sua Roleta está temporariamente bloqueada',
        'texto', format('Seu CRM está em %s%% e o mínimo exigido é %s%%. Atualize seus clientes (%s precisam de atualização) e você volta automaticamente ao chegar a %s%%.',
                        to_char(round((v_saude->>'pct')::numeric,1),'FM990D0'), v_min::text, COALESCE(v_saude->>'a_atualizar','0'), v_min::text),
        'pct', round((v_saude->>'pct')::numeric,1), 'minimo', v_min, 'a_atualizar', v_saude->'a_atualizar');
    END IF;
  ELSIF (NOT v_so_noturna) OR COALESCE(p_janela, '') = 'noturna' THEN
    v_vermelhos := public.contar_leads_vermelhos(p_auth_user_id);
    IF v_vermelhos > v_limite_vermelhos THEN
      RETURN jsonb_build_object(
        'bloqueado', true, 'codigo', 'vermelhos',
        'titulo', 'Leads vermelhos acima do limite',
        'texto', format('Você tem %s leads vermelhos (limite: %s). Atualize pelo menos %s para liberar.', v_vermelhos, v_limite_vermelhos, v_vermelhos - v_limite_vermelhos),
        'vermelhos', v_vermelhos, 'limite_vermelhos', v_limite_vermelhos);
    END IF;
  END IF;

  IF COALESCE(p_janela, '') = 'noturna' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.pipeline_atividades pa
      WHERE pa.responsavel_id = p_auth_user_id
        AND pa.tipo IN ('visita_agendada', 'visita_realizada')
        AND (pa.created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today
    ) INTO v_tem_visita_hoje;

    IF NOT v_tem_visita_hoje THEN
      RETURN jsonb_build_object('bloqueado', true, 'codigo', 'sem_visita_hoje',
        'titulo', 'Sem visita registrada hoje',
        'texto', 'A roleta noturna exige uma visita marcada ou realizada registrada hoje no pipeline.');
    END IF;

    IF v_noturna_exige THEN
      SELECT p.id INTO v_profile_id FROM public.profiles p WHERE p.user_id = p_auth_user_id;
      SELECT
        EXISTS(SELECT 1 FROM public.roleta_presencas rp WHERE rp.corretor_id = v_profile_id AND rp.data = v_today AND rp.turno = 'manha' AND rp.status IN ('na_empresa','saiu')),
        EXISTS(SELECT 1 FROM public.roleta_presencas rp WHERE rp.corretor_id = v_profile_id AND rp.data = v_today AND rp.turno = 'tarde' AND rp.status IN ('na_empresa','saiu'))
      INTO v_manha, v_tarde;
      IF NOT (v_manha AND v_tarde) THEN
        RETURN jsonb_build_object('bloqueado', true, 'codigo', 'presenca',
          'titulo', 'Presença do dia não validada',
          'texto', format('A noturna libera após o gestor confirmar sua presença na manhã (%s) e na tarde (%s).',
                          CASE WHEN v_manha THEN 'ok' ELSE 'pendente' END, CASE WHEN v_tarde THEN 'ok' ELSE 'pendente' END),
          'presente_manha', v_manha, 'presente_tarde', v_tarde);
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('bloqueado', false, 'codigo', 'ok', 'titulo', 'Elegível', 'texto', 'Você está apto a se credenciar.');
END;
$function$;

-- Entrega real: aplica a mesma checagem nos dois grupos de candidatos
DO $do$
DECLARE d text; n text; c int;
BEGIN
  d := pg_get_functiondef('public.distribuir_lead_atomico(uuid,text,uuid,boolean)'::regprocedure);
  IF position('roleta_crm_apto' in d) > 0 THEN RETURN; END IF;
  n := replace(d, E'AND COALESCE(rf.ativo, true) = true\n', E'AND COALESCE(rf.ativo, true) = true\n        AND public.roleta_crm_apto(p.user_id)\n');
  c := (length(n) - length(d)) / length(E'        AND public.roleta_crm_apto(p.user_id)\n');
  IF c <> 2 THEN RAISE EXCEPTION 'distribuir_lead_atomico: esperado 2 pontos de filtro, encontrado %', c; END IF;
  EXECUTE n;
END $do$;