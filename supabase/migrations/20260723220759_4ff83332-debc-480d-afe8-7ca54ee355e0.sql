
-- =========================================================
-- FASE 1: Consolidar roleta_fila (1 linha por corretor/data/janela)
-- =========================================================

-- Deduplicar mantendo a "melhor" linha por (corretor_id, data, janela):
-- preferindo ativo=true, maior ultima_distribuicao_at, e somando leads_recebidos.
WITH consolidado AS (
  SELECT
    (array_agg(id ORDER BY (COALESCE(ativo,true))::int DESC, ultima_distribuicao_at DESC NULLS LAST, id))[1] AS keep_id,
    corretor_id, data, janela,
    SUM(COALESCE(leads_recebidos,0))::int AS soma_leads,
    MAX(ultima_distribuicao_at) AS max_last,
    bool_or(COALESCE(ativo,true)) AS any_ativo
  FROM public.roleta_fila
  WHERE corretor_id IS NOT NULL
  GROUP BY corretor_id, data, janela
),
to_delete AS (
  SELECT rf.id
  FROM public.roleta_fila rf
  JOIN consolidado c
    ON c.corretor_id = rf.corretor_id
   AND c.data = rf.data
   AND c.janela = rf.janela
  WHERE rf.id <> c.keep_id
)
DELETE FROM public.roleta_fila WHERE id IN (SELECT id FROM to_delete);

-- Atualiza a linha remanescente com totais consolidados
UPDATE public.roleta_fila rf
SET leads_recebidos = c.soma_leads,
    ultima_distribuicao_at = c.max_last,
    ativo = c.any_ativo
FROM (
  SELECT
    (array_agg(id ORDER BY (COALESCE(ativo,true))::int DESC, ultima_distribuicao_at DESC NULLS LAST, id))[1] AS keep_id,
    SUM(COALESCE(leads_recebidos,0))::int AS soma_leads,
    MAX(ultima_distribuicao_at) AS max_last,
    bool_or(COALESCE(ativo,true)) AS any_ativo
  FROM public.roleta_fila
  WHERE corretor_id IS NOT NULL
  GROUP BY corretor_id, data, janela
) c
WHERE rf.id = c.keep_id;

-- Constraint UNIQUE por (corretor_id, data, janela)
ALTER TABLE public.roleta_fila
  DROP CONSTRAINT IF EXISTS roleta_fila_corretor_data_janela_key;
ALTER TABLE public.roleta_fila
  ADD CONSTRAINT roleta_fila_corretor_data_janela_key
  UNIQUE (corretor_id, data, janela);

-- =========================================================
-- FASE 2: Reescrever upsert_roleta_fila (idempotente por corretor/data/janela)
-- =========================================================
CREATE OR REPLACE FUNCTION public.upsert_roleta_fila(
  p_corretor_id uuid,
  p_segmento_id uuid,
  p_janela text,
  p_data date DEFAULT CURRENT_DATE,
  p_credenciamento_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next_pos integer;
BEGIN
  SELECT COALESCE(MAX(posicao), 0) + 1 INTO v_next_pos
  FROM roleta_fila
  WHERE data = p_data AND janela = p_janela;

  INSERT INTO roleta_fila (corretor_id, segmento_id, data, janela, posicao, credenciamento_id, ativo)
  VALUES (p_corretor_id, p_segmento_id, p_data, p_janela, v_next_pos, p_credenciamento_id, true)
  ON CONFLICT (corretor_id, data, janela) DO UPDATE
  SET ativo = true,
      credenciamento_id = COALESCE(EXCLUDED.credenciamento_id, roleta_fila.credenciamento_id),
      segmento_id = COALESCE(EXCLUDED.segmento_id, roleta_fila.segmento_id);
END;
$$;

-- =========================================================
-- FASE 3: Campos de auditoria em distribuicao_historico
-- =========================================================
ALTER TABLE public.distribuicao_historico
  ADD COLUMN IF NOT EXISTS empreendimento_canonico_id uuid,
  ADD COLUMN IF NOT EXISTS pool text,
  ADD COLUMN IF NOT EXISTS pool_size int,
  ADD COLUMN IF NOT EXISTS recebidos_no_produto int;

-- =========================================================
-- FASE 4: Nova distribuir_lead_atomico — fairness 1 a 1 por produto, fila CEO se sem alocado
-- =========================================================
CREATE OR REPLACE FUNCTION public.distribuir_lead_atomico(
  p_lead_id uuid,
  p_janela text DEFAULT NULL,
  p_exclude_auth_user_id uuid DEFAULT NULL,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead RECORD;
  v_segmento_id UUID;
  v_ignora_segmento BOOLEAN := FALSE;
  v_ignora_segmento_camp BOOLEAN := FALSE;
  v_target_janela TEXT;
  v_today_date DATE;
  v_is_sunday BOOLEAN;
  v_is_holiday BOOLEAN := FALSE;
  v_is_special_day BOOLEAN;
  v_chosen_fila_id UUID;
  v_chosen_profile_id UUID;
  v_chosen_auth_id UUID;
  v_chosen_recebidos_produto INT;
  v_now TIMESTAMPTZ := now();
  v_expire_at TIMESTAMPTZ;
  v_emp_lower TEXT;
  v_brt_hour NUMERIC;
  v_brt_minute NUMERIC;
  v_brt_mins NUMERIC;
  v_origens_gerais TEXT[];
  v_avulso_segmento_id UUID := '9948f523-29f4-46a7-bc1b-81ff8bb8dd50';
  v_lead_origem_lower TEXT;
  v_total_fila INT;
  v_failure_reason TEXT;
  v_matched_campaign BOOLEAN := FALSE;
  v_emp_canonico_id UUID;
  v_emp_ativo BOOLEAN;
  v_pool_size INT := 0;
  v_pool TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('distribuir_lead_atomico'));

  SELECT id, nome, telefone, empreendimento, aceite_status, corretor_id, origem, empreendimento_canonico_id
    INTO v_lead
  FROM public.pipeline_leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF v_lead IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF v_lead.corretor_id IS NOT NULL AND v_lead.aceite_status NOT IN ('pendente_distribuicao','timeout','aguardando_aceite','pendente','pendente_aceite') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;
  IF v_lead.corretor_id IS NOT NULL AND v_lead.aceite_status IN ('aceito') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;

  v_emp_canonico_id := v_lead.empreendimento_canonico_id;

  -- Bloqueio por empreendimento inativo
  IF v_emp_canonico_id IS NOT NULL AND NOT p_force THEN
    SELECT ativo INTO v_emp_ativo FROM public.empreendimentos_canonicos WHERE id = v_emp_canonico_id;
    IF COALESCE(v_emp_ativo, TRUE) = FALSE THEN
      UPDATE public.pipeline_leads
      SET aceite_status = 'pendente_distribuicao',
          motivo_pendencia = 'empreendimento_inativo',
          updated_at = v_now
      WHERE id = p_lead_id;

      INSERT INTO public.distribuicao_historico (pipeline_lead_id, corretor_id, segmento_id, acao, motivo_rejeicao, created_at, empreendimento_canonico_id, pool)
      VALUES (p_lead_id, NULL, NULL, 'bloqueado', 'empreendimento_inativo', v_now, v_emp_canonico_id, 'bloqueado');

      RETURN jsonb_build_object('success', false, 'reason', 'empreendimento_inativo', 'empreendimento_canonico_id', v_emp_canonico_id);
    END IF;
  END IF;

  -- Segmento (mantido, usado para credenciamento)
  SELECT string_to_array(valor, ',') INTO v_origens_gerais FROM public.roleta_config WHERE chave = 'origens_gerais';
  IF v_origens_gerais IS NULL THEN v_origens_gerais := ARRAY['jetimob']; END IF;

  v_lead_origem_lower := lower(trim(COALESCE(v_lead.origem,'')));
  v_emp_lower := lower(trim(COALESCE(v_lead.empreendimento,'')));

  IF v_lead_origem_lower LIKE '%imovelweb%' OR v_lead_origem_lower LIKE '%imovel web%' OR v_lead_origem_lower LIKE '%site%' THEN
    v_segmento_id := v_avulso_segmento_id;
    v_ignora_segmento := FALSE;
    v_matched_campaign := TRUE;
  END IF;

  IF NOT v_matched_campaign AND v_emp_lower <> '' THEN
    SELECT segmento_id, COALESCE(ignorar_segmento,false)
      INTO v_segmento_id, v_ignora_segmento_camp
    FROM public.roleta_campanhas
    WHERE ativo = true
      AND (lower(trim(empreendimento)) = v_emp_lower
           OR v_emp_lower LIKE '%'||lower(trim(empreendimento))||'%'
           OR lower(trim(empreendimento)) LIKE '%'||v_emp_lower||'%')
    ORDER BY (lower(trim(empreendimento)) = v_emp_lower) DESC, length(empreendimento) DESC
    LIMIT 1;

    IF v_segmento_id IS NOT NULL OR v_ignora_segmento_camp THEN v_matched_campaign := TRUE; END IF;
    IF v_ignora_segmento_camp THEN v_segmento_id := NULL; v_ignora_segmento := TRUE; END IF;
  END IF;

  IF NOT v_matched_campaign AND v_lead_origem_lower = ANY(v_origens_gerais) THEN
    v_segmento_id := NULL; v_ignora_segmento := TRUE;
  ELSIF NOT v_matched_campaign THEN
    v_segmento_id := v_avulso_segmento_id; v_ignora_segmento := FALSE;
  END IF;

  -- Janela
  v_today_date := (v_now AT TIME ZONE 'America/Sao_Paulo')::date;
  v_is_sunday := EXTRACT(DOW FROM (v_now AT TIME ZONE 'America/Sao_Paulo')) = 0;
  SELECT EXISTS(SELECT 1 FROM public.feriados WHERE data = v_today_date) INTO v_is_holiday;
  v_is_special_day := v_is_sunday OR v_is_holiday;
  v_brt_hour := EXTRACT(HOUR FROM (v_now AT TIME ZONE 'America/Sao_Paulo'));
  v_brt_minute := EXTRACT(MINUTE FROM (v_now AT TIME ZONE 'America/Sao_Paulo'));
  v_brt_mins := v_brt_hour * 60 + v_brt_minute;

  IF v_is_special_day THEN v_target_janela := 'dia_todo';
  ELSIF p_janela IS NOT NULL AND p_janela <> 'qualquer' THEN v_target_janela := p_janela;
  ELSE
    IF v_brt_mins < 720 THEN v_target_janela := 'manha';
    ELSIF v_brt_mins < 1110 THEN v_target_janela := 'tarde';
    ELSE v_target_janela := 'noturna'; END IF;
  END IF;

  v_expire_at := v_now + interval '10 minutes';

  -- ============================================================
  -- REGRA: se lead tem empreendimento canônico, só distribui para
  -- corretores ALOCADOS ao produto E ativos/credenciados no turno.
  -- Se ninguém elegível, vai para FILA CEO (sem fallback geral).
  -- ============================================================
  IF v_emp_canonico_id IS NOT NULL THEN
    WITH elegiveis AS (
      SELECT
        rf.id AS fila_id,
        p.id AS profile_id,
        p.user_id AS auth_id,
        rf.ultima_distribuicao_at,
        COALESCE(rf.leads_recebidos,0) AS leads_recebidos,
        (
          SELECT count(*)
          FROM public.roleta_distribuicoes rd
          JOIN public.pipeline_leads pl ON pl.id = rd.lead_id
          WHERE rd.corretor_id = p.id
            AND rd.janela = v_target_janela
            AND rd.enviado_em >= (v_today_date::timestamp AT TIME ZONE 'America/Sao_Paulo')
            AND rd.enviado_em <  ((v_today_date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
            AND pl.empreendimento_canonico_id = v_emp_canonico_id
        )::int AS recebidos_no_produto
      FROM public.roleta_fila rf
      INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
      INNER JOIN public.profiles p ON p.id = rf.corretor_id
      INNER JOIN public.corretor_alocacao ca ON ca.user_id = p.user_id
      LEFT JOIN public.corretor_disponibilidade cd ON cd.user_id = p.user_id
      WHERE rc.status = 'aprovado'
        AND rc.data = v_today_date
        AND (rc.janela = v_target_janela OR rc.janela = 'dia_todo' OR v_target_janela = 'dia_todo')
        AND (p_exclude_auth_user_id IS NULL OR p.user_id <> p_exclude_auth_user_id)
        AND COALESCE(cd.na_roleta, true) = true
        AND COALESCE(rf.ativo, true) = true
        AND v_emp_canonico_id = ANY(ca.empreendimentos)
        AND NOT EXISTS (
          SELECT 1 FROM public.distribuicao_historico dh
          WHERE dh.pipeline_lead_id = p_lead_id
            AND dh.corretor_id = p.user_id
            AND dh.acao = 'rejeitado'
            AND lower(COALESCE(dh.motivo_rejeicao, '')) = 'cliente_repetido'
        )
    )
    SELECT count(*) INTO v_pool_size FROM elegiveis;

    IF v_pool_size > 0 THEN
      v_pool := 'alocado';
      WITH elegiveis AS (
        SELECT
          rf.id AS fila_id,
          p.id AS profile_id,
          p.user_id AS auth_id,
          rf.ultima_distribuicao_at,
          COALESCE(rf.leads_recebidos,0) AS leads_recebidos,
          (
            SELECT count(*)
            FROM public.roleta_distribuicoes rd
            JOIN public.pipeline_leads pl ON pl.id = rd.lead_id
            WHERE rd.corretor_id = p.id
              AND rd.janela = v_target_janela
              AND rd.enviado_em >= (v_today_date::timestamp AT TIME ZONE 'America/Sao_Paulo')
              AND rd.enviado_em <  ((v_today_date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
              AND pl.empreendimento_canonico_id = v_emp_canonico_id
          )::int AS recebidos_no_produto
        FROM public.roleta_fila rf
        INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
        INNER JOIN public.profiles p ON p.id = rf.corretor_id
        INNER JOIN public.corretor_alocacao ca ON ca.user_id = p.user_id
        LEFT JOIN public.corretor_disponibilidade cd ON cd.user_id = p.user_id
        WHERE rc.status = 'aprovado'
          AND rc.data = v_today_date
          AND (rc.janela = v_target_janela OR rc.janela = 'dia_todo' OR v_target_janela = 'dia_todo')
          AND (p_exclude_auth_user_id IS NULL OR p.user_id <> p_exclude_auth_user_id)
          AND COALESCE(cd.na_roleta, true) = true
          AND COALESCE(rf.ativo, true) = true
          AND v_emp_canonico_id = ANY(ca.empreendimentos)
          AND NOT EXISTS (
            SELECT 1 FROM public.distribuicao_historico dh
            WHERE dh.pipeline_lead_id = p_lead_id
              AND dh.corretor_id = p.user_id
              AND dh.acao = 'rejeitado'
              AND lower(COALESCE(dh.motivo_rejeicao, '')) = 'cliente_repetido'
          )
      )
      SELECT fila_id, profile_id, auth_id, recebidos_no_produto
        INTO v_chosen_fila_id, v_chosen_profile_id, v_chosen_auth_id, v_chosen_recebidos_produto
      FROM elegiveis
      ORDER BY recebidos_no_produto ASC,
               ultima_distribuicao_at NULLS FIRST,
               leads_recebidos ASC,
               fila_id ASC
      LIMIT 1;
    ELSE
      -- Sem corretor alocado/ativo para o produto → FILA CEO (sem fallback geral)
      UPDATE public.pipeline_leads
      SET aceite_status = 'pendente_distribuicao',
          motivo_pendencia = 'sem_alocado_produto',
          updated_at = v_now
      WHERE id = p_lead_id;

      INSERT INTO public.distribuicao_historico
        (pipeline_lead_id, corretor_id, segmento_id, acao, motivo_rejeicao, created_at, empreendimento_canonico_id, pool, pool_size)
      VALUES
        (p_lead_id, NULL, v_segmento_id, 'fila_ceo', 'sem_alocado_produto', v_now, v_emp_canonico_id, 'fila_ceo', 0);

      RETURN jsonb_build_object(
        'success', false,
        'reason', 'sem_alocado_produto',
        'segmento_id', v_segmento_id,
        'empreendimento_canonico_id', v_emp_canonico_id,
        'janela', v_target_janela
      );
    END IF;
  ELSE
    -- Lead SEM empreendimento canônico → fluxo por segmento (comportamento anterior).
    v_pool := 'segmento';
    WITH elegiveis AS (
      SELECT
        rf.id AS fila_id,
        p.id AS profile_id,
        p.user_id AS auth_id,
        rf.ultima_distribuicao_at,
        COALESCE(rf.leads_recebidos,0) AS leads_recebidos,
        (
          SELECT count(*)
          FROM public.roleta_distribuicoes rd
          WHERE rd.corretor_id = p.id
            AND rd.janela = v_target_janela
            AND rd.enviado_em >= (v_today_date::timestamp AT TIME ZONE 'America/Sao_Paulo')
            AND rd.enviado_em <  ((v_today_date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
            AND (v_ignora_segmento OR rd.segmento_id = v_segmento_id OR rd.segmento_id IS NULL)
        )::int AS recebidos_no_turno
      FROM public.roleta_fila rf
      INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
      INNER JOIN public.profiles p ON p.id = rf.corretor_id
      LEFT JOIN public.corretor_disponibilidade cd ON cd.user_id = p.user_id
      WHERE rc.status = 'aprovado'
        AND rc.data = v_today_date
        AND (rc.janela = v_target_janela OR rc.janela = 'dia_todo' OR v_target_janela = 'dia_todo')
        AND (v_ignora_segmento OR rc.segmento_1_id = v_segmento_id OR rc.segmento_2_id = v_segmento_id)
        AND (p_exclude_auth_user_id IS NULL OR p.user_id <> p_exclude_auth_user_id)
        AND COALESCE(cd.na_roleta, true) = true
        AND COALESCE(rf.ativo, true) = true
        AND NOT EXISTS (
          SELECT 1 FROM public.distribuicao_historico dh
          WHERE dh.pipeline_lead_id = p_lead_id
            AND dh.corretor_id = p.user_id
            AND dh.acao = 'rejeitado'
            AND lower(COALESCE(dh.motivo_rejeicao, '')) = 'cliente_repetido'
        )
    )
    SELECT fila_id, profile_id, auth_id, recebidos_no_turno, (SELECT count(*) FROM elegiveis)
      INTO v_chosen_fila_id, v_chosen_profile_id, v_chosen_auth_id, v_chosen_recebidos_produto, v_pool_size
    FROM elegiveis
    ORDER BY recebidos_no_turno ASC,
             ultima_distribuicao_at NULLS FIRST,
             leads_recebidos ASC,
             fila_id ASC
    LIMIT 1;
  END IF;

  IF v_chosen_fila_id IS NULL THEN
    SELECT count(*) INTO v_total_fila
    FROM public.roleta_fila rf
    INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
    WHERE rc.status = 'aprovado' AND rc.data = v_today_date;

    IF v_total_fila = 0 THEN v_failure_reason := 'no_fila_active';
    ELSE v_failure_reason := 'no_broker_available'; END IF;

    UPDATE public.pipeline_leads
    SET motivo_pendencia = v_failure_reason,
        updated_at = v_now
    WHERE id = p_lead_id
      AND aceite_status = 'pendente_distribuicao';

    RETURN jsonb_build_object(
      'success', false, 'reason', v_failure_reason,
      'segmento_id', v_segmento_id, 'janela', v_target_janela,
      'total_fila_today', v_total_fila,
      'pool', v_pool
    );
  END IF;

  UPDATE public.pipeline_leads
  SET corretor_id = v_chosen_auth_id,
      aceite_status = 'aguardando_aceite',
      aceite_expira_em = v_expire_at,
      distribuido_em = v_now,
      motivo_pendencia = NULL,
      updated_at = v_now
  WHERE id = p_lead_id
    AND (
      corretor_id IS NULL
      OR aceite_status IN ('pendente_distribuicao','timeout','aguardando_aceite','pendente','pendente_aceite')
    );

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;

  UPDATE public.roleta_fila
  SET ultima_distribuicao_at = v_now,
      leads_recebidos = COALESCE(leads_recebidos, 0) + 1
  WHERE id = v_chosen_fila_id;

  INSERT INTO public.roleta_distribuicoes (lead_id, corretor_id, segmento_id, janela, enviado_em, expira_em, status)
  VALUES (p_lead_id, v_chosen_profile_id, v_segmento_id, v_target_janela, v_now, v_expire_at, 'aguardando');

  INSERT INTO public.distribuicao_historico
    (pipeline_lead_id, corretor_id, segmento_id, acao, created_at,
     empreendimento_canonico_id, pool, pool_size, recebidos_no_produto)
  VALUES
    (p_lead_id, v_chosen_auth_id, v_segmento_id, 'distribuido', v_now,
     v_emp_canonico_id, v_pool, v_pool_size, v_chosen_recebidos_produto);

  RETURN jsonb_build_object(
    'success', true,
    'corretor_id', v_chosen_auth_id,
    'profile_id', v_chosen_profile_id,
    'segmento_id', v_segmento_id,
    'empreendimento_canonico_id', v_emp_canonico_id,
    'janela', v_target_janela,
    'expira_em', v_expire_at,
    'pool', v_pool,
    'pool_size', v_pool_size,
    'recebidos_no_produto', v_chosen_recebidos_produto
  );
END;
$$;
