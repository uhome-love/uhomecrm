-- 1) Contagem de leads VERMELHOS (mesma régua das pílulas de saúde)
CREATE OR REPLACE FUNCTION public.contar_leads_vermelhos(p_corretor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH scope_ids AS (
    SELECT unnest(public.resolve_corretor_scope_ids(p_corretor_id)) AS id
  )
  SELECT COUNT(*)::INTEGER
  FROM public.pipeline_leads pl
  JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id IN (SELECT id FROM scope_ids)
    AND COALESCE(pl.arquivado, false) = false
    AND COALESCE(ps.tipo::text, '') NOT IN ('descarte', 'convertido', 'venda', 'caiu')
    AND public.lead_saude_status(
          pl.ultimo_toque_at,
          COALESCE(pl.distribuido_em, pl.aceito_em, pl.created_at),
          ps.tipo::text
        ) = 'vermelho';
$function$;

GRANT EXECUTE ON FUNCTION public.contar_leads_vermelhos(uuid) TO authenticated;

-- 2) Gate por janela (limite de vermelhos só na noturna, por enquanto)
DROP VIEW IF EXISTS public.v_corretor_roleta_status;
DROP FUNCTION IF EXISTS public.corretor_pode_entrar_roleta(uuid);

CREATE OR REPLACE FUNCTION public.corretor_pode_entrar_roleta(
  p_corretor_id uuid,
  p_janela text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_vermelhos        INTEGER;
  v_limite_vermelhos INTEGER;
  v_so_noturna       BOOLEAN;
  v_limite_descartes INTEGER;
  v_descartes_mes    INTEGER;
  v_desbloqueio      BOOLEAN;
BEGIN
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_leads_desatualizados'), 10)
    INTO v_limite_vermelhos;
  SELECT COALESCE((SELECT valor::BOOLEAN FROM public.roleta_config WHERE chave = 'limite_vermelhos_apenas_noturna'), true)
    INTO v_so_noturna;
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_descartes_mes'), 100)
    INTO v_limite_descartes;

  SELECT COUNT(*)::INTEGER INTO v_descartes_mes
  FROM public.pipeline_leads pl
  JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(public.resolve_corretor_scope_ids(p_corretor_id))
    AND COALESCE(ps.tipo::text, '') = 'descarte'
    AND pl.stage_changed_at >= date_trunc('month', CURRENT_DATE)
    AND pl.stage_changed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

  SELECT EXISTS (
    SELECT 1 FROM public.roleta_desbloqueios
    WHERE corretor_id = p_corretor_id
      AND mes = to_char(CURRENT_DATE, 'YYYY-MM')
  ) INTO v_desbloqueio;

  IF v_descartes_mes >= v_limite_descartes AND NOT v_desbloqueio THEN
    RETURN FALSE;
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

GRANT EXECUTE ON FUNCTION public.corretor_pode_entrar_roleta(uuid, text) TO authenticated;

CREATE VIEW public.v_corretor_roleta_status AS
 SELECT p.user_id AS corretor_id,
    p.nome,
    public.corretor_pode_entrar_roleta(p.user_id, NULL::text) AS pode_entrar_roleta,
    public.contar_leads_vermelhos(p.user_id) AS leads_desatualizados,
    ( SELECT count(*) AS count
           FROM public.pipeline_tarefas pt
             JOIN public.pipeline_leads pl ON pl.id = pt.pipeline_lead_id
          WHERE pt.responsavel_id = p.user_id AND pt.concluida_em IS NULL AND pt.vence_em < (now() - '24:00:00'::interval)::date) AS tarefas_atrasadas,
    ( SELECT count(*) AS count
           FROM public.pipeline_leads pl
          WHERE pl.corretor_id = p.user_id AND (pl.lead_temperatura = ANY (ARRAY['quente'::text, 'urgente'::text]))) AS leads_quentes
   FROM public.profiles p
     JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role = 'corretor'::app_role;

GRANT SELECT ON public.v_corretor_roleta_status TO authenticated;

-- 3) Noturna
CREATE OR REPLACE FUNCTION public.corretor_pode_entrar_roleta_noturna(p_corretor_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_ok BOOLEAN;
  v_tem_visita_hoje BOOLEAN;
BEGIN
  v_ok := public.corretor_pode_entrar_roleta(p_corretor_id, 'noturna');
  IF NOT v_ok THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.pipeline_atividades pa
    WHERE pa.responsavel_id = p_corretor_id
      AND pa.tipo IN ('visita_agendada', 'visita_realizada')
      AND (pa.created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ) INTO v_tem_visita_hoje;

  RETURN v_tem_visita_hoje;
END;
$function$;

-- 4) Elegibilidade completa
CREATE OR REPLACE FUNCTION public.get_elegibilidade_roleta(p_corretor_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vermelhos             INTEGER;
  v_pode_base             BOOLEAN;
  v_pode_noturna_gate     BOOLEAN;
  v_tem_visita_hoje       BOOLEAN;
  v_pode_roleta_noturna   BOOLEAN;
  v_descartes_mes         INTEGER;
  v_bloqueado_descarte    BOOLEAN;
  v_visitas_semana        INTEGER;
  v_pode_domingo          BOOLEAN;
  v_limite_leads          INTEGER;
  v_limite_descartes      INTEGER;
  v_so_noturna            BOOLEAN;
  v_visitas_min_domingo   INTEGER;
  v_presencas_min_domingo INTEGER;
  v_monday_date           DATE;
  v_saturday_date         DATE;
  v_today_brt             DATE;
  v_profile_id            UUID;
  v_desbloqueio_manual    BOOLEAN;
  v_presente_manha        BOOLEAN;
  v_presente_tarde        BOOLEAN;
  v_presencas_semana      INTEGER;
  v_noturna_exige         BOOLEAN;
  v_leads_json            JSON;
BEGIN
  v_vermelhos := public.contar_leads_vermelhos(p_corretor_id);

  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_leads_desatualizados'), 10)
    INTO v_limite_leads;
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'limite_descartes_mes'), 100)
    INTO v_limite_descartes;
  SELECT COALESCE((SELECT valor::BOOLEAN FROM public.roleta_config WHERE chave = 'limite_vermelhos_apenas_noturna'), true)
    INTO v_so_noturna;
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'visitas_minimas_domingo'), 2)
    INTO v_visitas_min_domingo;
  SELECT COALESCE((SELECT valor::INTEGER FROM public.roleta_config WHERE chave = 'presencas_minimas_domingo'), 4)
    INTO v_presencas_min_domingo;
  SELECT COALESCE((SELECT valor::BOOLEAN FROM public.roleta_config WHERE chave = 'noturna_exige_manha_tarde'), true)
    INTO v_noturna_exige;

  SELECT p.id INTO v_profile_id
  FROM public.profiles p
  WHERE p.user_id = p_corretor_id
  LIMIT 1;

  SELECT COUNT(*)::INTEGER INTO v_descartes_mes
  FROM public.pipeline_leads pl
  JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.corretor_id = ANY(public.resolve_corretor_scope_ids(p_corretor_id))
    AND COALESCE(ps.tipo::text, '') = 'descarte'
    AND pl.stage_changed_at >= date_trunc('month', CURRENT_DATE)
    AND pl.stage_changed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

  SELECT EXISTS (
    SELECT 1 FROM public.roleta_desbloqueios
    WHERE corretor_id = p_corretor_id
      AND mes = to_char(CURRENT_DATE, 'YYYY-MM')
  ) INTO v_desbloqueio_manual;

  v_bloqueado_descarte := v_descartes_mes >= v_limite_descartes AND NOT v_desbloqueio_manual;

  v_pode_base := NOT v_bloqueado_descarte AND (v_so_noturna OR v_vermelhos <= v_limite_leads);
  v_pode_noturna_gate := NOT v_bloqueado_descarte AND v_vermelhos <= v_limite_leads;

  v_today_brt := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  SELECT EXISTS (
    SELECT 1
    FROM public.pipeline_atividades pa
    WHERE pa.responsavel_id = p_corretor_id
      AND pa.tipo IN ('visita_agendada', 'visita_realizada')
      AND (pa.created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today_brt
    UNION ALL
    SELECT 1
    FROM public.visitas v
    WHERE v.corretor_id IN (p_corretor_id, v_profile_id)
      AND v.data_visita >= v_today_brt
      AND v.status IN ('marcada','confirmada','reagendada','realizada')
    LIMIT 1
  ) INTO v_tem_visita_hoje;

  SELECT
    EXISTS(SELECT 1 FROM public.roleta_presencas rp
            WHERE rp.corretor_id = v_profile_id
              AND rp.data = v_today_brt
              AND rp.turno = 'manha'
              AND rp.status IN ('na_empresa','saiu')),
    EXISTS(SELECT 1 FROM public.roleta_presencas rp
            WHERE rp.corretor_id = v_profile_id
              AND rp.data = v_today_brt
              AND rp.turno = 'tarde'
              AND rp.status IN ('na_empresa','saiu'))
  INTO v_presente_manha, v_presente_tarde;

  v_pode_roleta_noturna := v_pode_noturna_gate
    AND v_tem_visita_hoje
    AND (
      NOT v_noturna_exige
      OR (v_presente_manha AND v_presente_tarde)
    );

  v_monday_date := v_today_brt - ((EXTRACT(DOW FROM v_today_brt)::INTEGER + 6) % 7);
  v_saturday_date := v_monday_date + 5;

  SELECT COUNT(*)::INTEGER INTO v_visitas_semana
  FROM public.visitas v
  WHERE v.corretor_id IN (p_corretor_id, v_profile_id)
    AND v.status = 'realizada'
    AND v.data_visita >= v_monday_date
    AND v.data_visita <= v_saturday_date;

  SELECT COUNT(DISTINCT rp.data)::INTEGER INTO v_presencas_semana
  FROM public.roleta_presencas rp
  WHERE rp.corretor_id = v_profile_id
    AND rp.data >= v_monday_date
    AND rp.data <= v_saturday_date
    AND rp.status IN ('na_empresa','saiu');

  v_pode_domingo := v_pode_base
    AND v_visitas_semana >= v_visitas_min_domingo
    AND v_presencas_semana >= v_presencas_min_domingo;

  SELECT COALESCE(json_agg(x ORDER BY x.dias_sem_tarefa DESC), '[]'::json) INTO v_leads_json
  FROM (
    SELECT pl.id,
           pl.nome,
           COALESCE(ps.nome, ps.tipo::text, '') AS stage,
           GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE(pl.ultimo_toque_at, pl.distribuido_em, pl.aceito_em, pl.created_at)))/86400)::INTEGER AS dias_sem_tarefa
    FROM public.pipeline_leads pl
    JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
    WHERE pl.corretor_id = ANY(public.resolve_corretor_scope_ids(p_corretor_id))
      AND COALESCE(pl.arquivado, false) = false
      AND COALESCE(ps.tipo::text, '') NOT IN ('descarte', 'convertido', 'venda', 'caiu')
      AND public.lead_saude_status(
            pl.ultimo_toque_at,
            COALESCE(pl.distribuido_em, pl.aceito_em, pl.created_at),
            ps.tipo::text
          ) = 'vermelho'
    ORDER BY COALESCE(pl.ultimo_toque_at, pl.distribuido_em, pl.aceito_em, pl.created_at) ASC
    LIMIT 10
  ) x;

  RETURN json_build_object(
    'leads_desatualizados', v_vermelhos,
    'limite_bloqueio', v_limite_leads,
    'faltam_para_bloquear', GREATEST(0, v_limite_leads - v_vermelhos),
    'limite_vermelhos_apenas_noturna', v_so_noturna,
    'pode_entrar_roleta', v_pode_base,
    'tem_visita_hoje', v_tem_visita_hoje,
    'pode_roleta_noturna', v_pode_roleta_noturna,
    'pode_roleta_manha', v_pode_base,
    'pode_roleta_tarde', v_pode_base,
    'descartes_mes', v_descartes_mes,
    'limite_descartes', v_limite_descartes,
    'bloqueado_descarte', v_bloqueado_descarte,
    'desbloqueio_manual', v_desbloqueio_manual,
    'visitas_semana', v_visitas_semana,
    'pode_domingo', v_pode_domingo,
    'visitas_min_domingo', v_visitas_min_domingo,
    'presente_manha_hoje', v_presente_manha,
    'presente_tarde_hoje', v_presente_tarde,
    'presencas_semana', v_presencas_semana,
    'presencas_minimas_domingo', v_presencas_min_domingo,
    'noturna_exige_manha_tarde', v_noturna_exige,
    'leads_para_atualizar', v_leads_json
  );
END;
$function$;

-- 5) Credenciamentos aplicam o gate por janela
CREATE OR REPLACE FUNCTION public.credenciar_na_roleta(p_corretor_id uuid, p_auth_user_id uuid, p_janela text, p_segmento_1_id uuid, p_segmento_2_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pode BOOLEAN;
  v_cred_id UUID;
  v_hoje DATE := CURRENT_DATE;
  v_max_pos INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_corretor_id AND user_id = p_auth_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Profile não pertence ao usuário');
  END IF;

  v_pode := corretor_pode_entrar_roleta(p_auth_user_id, p_janela);
  IF NOT v_pode THEN
    RETURN json_build_object('success', false, 'error',
      'Você está bloqueado para esta janela: leads vermelhos acima do limite ou excesso de descartes no mês. Atualize seu pipeline.');
  END IF;

  INSERT INTO roleta_credenciamentos (
    corretor_id, auth_user_id, data, janela,
    segmento_1_id, segmento_2_id, status
  ) VALUES (
    p_corretor_id, p_auth_user_id, v_hoje, p_janela,
    p_segmento_1_id, p_segmento_2_id, 'aprovado'
  )
  ON CONFLICT (corretor_id, data, janela)
  DO UPDATE SET
    segmento_1_id = EXCLUDED.segmento_1_id,
    segmento_2_id = EXCLUDED.segmento_2_id,
    status = 'aprovado',
    saiu_em = NULL
  RETURNING id INTO v_cred_id;

  SELECT COALESCE(MAX(posicao), 0) INTO v_max_pos
  FROM roleta_fila WHERE data = v_hoje AND janela = p_janela AND ativo = true;

  INSERT INTO roleta_fila (credenciamento_id, corretor_id, segmento_id, data, janela, posicao, ativo)
  VALUES (v_cred_id, p_corretor_id, p_segmento_1_id, v_hoje, p_janela, v_max_pos + 1, true)
  ON CONFLICT DO NOTHING;

  IF p_segmento_2_id IS NOT NULL THEN
    INSERT INTO roleta_fila (credenciamento_id, corretor_id, segmento_id, data, janela, posicao, ativo)
    VALUES (v_cred_id, p_corretor_id, p_segmento_2_id, v_hoje, p_janela, v_max_pos + 2, true)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE corretor_disponibilidade
  SET na_roleta = true, updated_at = NOW()
  WHERE user_id = p_auth_user_id;

  IF NOT FOUND THEN
    INSERT INTO corretor_disponibilidade (user_id, na_roleta, status, updated_at)
    VALUES (p_auth_user_id, true, 'online', NOW())
    ON CONFLICT (user_id) DO UPDATE SET na_roleta = true, updated_at = NOW();
  END IF;

  RETURN json_build_object(
    'success', true,
    'credenciamento_id', v_cred_id,
    'status', 'aprovado',
    'message', 'Credenciamento aprovado! Você está na roleta.'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.credenciar_por_alocacao(p_janela text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_pode boolean;
  v_alocacao uuid[];
  v_segmentos uuid[];
  v_seg1 uuid;
  v_seg2 uuid;
  v_cred_id uuid;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id INTO v_profile_id FROM profiles WHERE user_id = v_auth_user_id;
  IF v_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profile não encontrado');
  END IF;

  v_pode := corretor_pode_entrar_roleta(v_auth_user_id, p_janela);
  IF NOT v_pode THEN
    RETURN json_build_object('success', false, 'error',
      'Você está bloqueado para esta janela: leads vermelhos acima do limite ou excesso de descartes no mês. Atualize seu pipeline.');
  END IF;

  SELECT empreendimentos INTO v_alocacao
  FROM corretor_alocacao WHERE user_id = v_auth_user_id;

  IF v_alocacao IS NULL OR array_length(v_alocacao, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Você ainda não tem empreendimentos alocados. Fale com seu gestor.');
  END IF;

  SELECT array_agg(DISTINCT ec.segmento_id)
    INTO v_segmentos
  FROM empreendimentos_canonicos ec
  WHERE ec.id = ANY(v_alocacao)
    AND ec.segmento_id IS NOT NULL;

  IF v_segmentos IS NULL OR array_length(v_segmentos, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Nenhum segmento identificado nos empreendimentos alocados. Fale com seu gestor.');
  END IF;

  v_seg1 := v_segmentos[1];
  IF array_length(v_segmentos, 1) >= 2 THEN v_seg2 := v_segmentos[2]; END IF;

  INSERT INTO roleta_credenciamentos (
    corretor_id, auth_user_id, data, janela,
    segmento_1_id, segmento_2_id, status
  ) VALUES (
    v_profile_id, v_auth_user_id, v_hoje, p_janela,
    v_seg1, v_seg2, 'pendente'
  )
  ON CONFLICT (corretor_id, data, janela)
  DO UPDATE SET
    segmento_1_id = EXCLUDED.segmento_1_id,
    segmento_2_id = EXCLUDED.segmento_2_id,
    status = CASE
      WHEN roleta_credenciamentos.status = 'aprovado' THEN 'aprovado'
      ELSE 'pendente'
    END,
    saiu_em = NULL
  RETURNING id INTO v_cred_id;

  RETURN json_build_object('success', true, 'credenciamento_id', v_cred_id,
    'message', 'Credenciamento enviado! Aguardando aprovação do CEO.');
END;
$function$;
