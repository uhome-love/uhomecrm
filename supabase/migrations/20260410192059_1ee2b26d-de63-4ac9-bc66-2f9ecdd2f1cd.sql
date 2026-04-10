
-- ================================================================
-- PARTE 2: Corrigir trigger offline (BUG #3 — auth ID vs profile ID)
-- ================================================================

CREATE OR REPLACE FUNCTION public.auto_remove_from_roleta_on_offline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hoje       date;
  v_profile_id uuid;
BEGIN
  IF NEW.status IN ('offline', 'fora_empresa', 'em_pausa')
     AND (OLD.status IS DISTINCT FROM NEW.status)
  THEN
    v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

    SELECT id INTO v_profile_id
    FROM profiles
    WHERE user_id = NEW.user_id;

    NEW.na_roleta := false;
    NEW.saida_em  := now();

    UPDATE roleta_fila
    SET ativo = false
    WHERE corretor_id = v_profile_id
      AND data = v_hoje
      AND ativo = true;

    UPDATE roleta_credenciamentos
    SET status  = 'saiu',
        saiu_em = now()
    WHERE corretor_id = v_profile_id
      AND data = v_hoje
      AND status IN ('aprovado', 'pendente');
  END IF;

  RETURN NEW;
END;
$$;

-- ================================================================
-- PARTE 3: Corrigir rejeitar_lead (BUG #2 — aceitar aguardando_aceite)
-- ================================================================

DROP FUNCTION IF EXISTS public.rejeitar_lead(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.rejeitar_lead(
  p_lead_id    uuid,
  p_corretor_id uuid,
  p_motivo     text DEFAULT 'outro'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead RECORD;
  v_now  timestamptz := now();
BEGIN
  SELECT id, corretor_id, aceite_status
  INTO v_lead
  FROM pipeline_leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF v_lead.corretor_id IS DISTINCT FROM p_corretor_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_your_lead');
  END IF;

  IF v_lead.aceite_status NOT IN ('pendente', 'aguardando_aceite') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_pending');
  END IF;

  UPDATE pipeline_leads
  SET aceite_status  = 'pendente_distribuicao',
      corretor_id    = NULL,
      distribuido_em = NULL,
      aceite_expira_em = NULL,
      updated_at     = v_now
  WHERE id = p_lead_id;

  UPDATE roleta_distribuicoes
  SET status = 'recusado'
  WHERE lead_id = p_lead_id AND status = 'aguardando';

  INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, acao, motivo_rejeicao)
  VALUES (p_lead_id, p_corretor_id, 'rejeitado', p_motivo);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ================================================================
-- PARTE 4: Corrigir trg_auto_distribute_lead (BUGS #1 e #4)
-- ================================================================

CREATE OR REPLACE FUNCTION public.trg_auto_distribute_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_segmento_id        UUID;
  v_ignora_segmento    BOOLEAN := FALSE;
  v_target_janela      TEXT;
  v_today_date         DATE;
  v_is_sunday          BOOLEAN;
  v_is_holiday         BOOLEAN := FALSE;
  v_is_special_day     BOOLEAN;
  v_chosen_fila_id     UUID;
  v_chosen_profile_id  UUID;
  v_chosen_auth_id     UUID;
  v_now                TIMESTAMPTZ := now();
  v_emp_lower          TEXT;
  v_brt_hour           NUMERIC;
  v_brt_minute         NUMERIC;
  v_brt_mins           NUMERIC;
  v_origens_gerais     TEXT[];
  v_lead_origem_lower  TEXT;
BEGIN
  -- CORREÇÃO BUG #4: leads manuais não entram na roleta
  IF NEW.aceite_status = 'pendente_distribuicao' THEN
    RETURN NEW;
  END IF;

  IF NEW.corretor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('distribuir_lead'));

  SELECT string_to_array(valor, ',') INTO v_origens_gerais
  FROM public.roleta_config WHERE chave = 'origens_gerais';
  IF v_origens_gerais IS NULL THEN
    v_origens_gerais := ARRAY['site', 'site_uhome', 'imovelweb', 'jetimob'];
  END IF;

  v_lead_origem_lower := lower(trim(COALESCE(NEW.origem, '')));

  IF v_lead_origem_lower = ANY(v_origens_gerais) THEN
    v_ignora_segmento := TRUE;
  END IF;

  v_emp_lower := lower(trim(COALESCE(NEW.empreendimento, '')));
  IF v_emp_lower <> '' AND NOT v_ignora_segmento THEN
    SELECT segmento_id, COALESCE(ignorar_segmento, false)
    INTO v_segmento_id, v_ignora_segmento
    FROM public.roleta_campanhas
    WHERE ativo = true
      AND (
        lower(trim(empreendimento)) = v_emp_lower
        OR v_emp_lower LIKE '%' || lower(trim(empreendimento)) || '%'
        OR lower(trim(empreendimento)) LIKE '%' || v_emp_lower || '%'
      )
    LIMIT 1;

    IF v_ignora_segmento THEN
      v_segmento_id := NULL;
    END IF;
  END IF;

  IF v_lead_origem_lower = ANY(v_origens_gerais) THEN
    v_segmento_id     := NULL;
    v_ignora_segmento := TRUE;
  END IF;

  IF v_emp_lower = '' THEN
    v_ignora_segmento := TRUE;
    v_segmento_id     := NULL;
  END IF;

  v_today_date     := (v_now AT TIME ZONE 'America/Sao_Paulo')::date;
  v_is_sunday      := EXTRACT(DOW FROM (v_now AT TIME ZONE 'America/Sao_Paulo')) = 0;
  SELECT EXISTS(SELECT 1 FROM public.feriados WHERE data = v_today_date) INTO v_is_holiday;
  v_is_special_day := v_is_sunday OR v_is_holiday;

  v_brt_hour   := EXTRACT(HOUR   FROM (v_now AT TIME ZONE 'America/Sao_Paulo'));
  v_brt_minute := EXTRACT(MINUTE FROM (v_now AT TIME ZONE 'America/Sao_Paulo'));
  v_brt_mins   := v_brt_hour * 60 + v_brt_minute;

  IF v_is_special_day THEN
    v_target_janela := 'dia_todo';
  ELSIF v_brt_mins < 720 THEN
    v_target_janela := 'manha';
  ELSIF v_brt_mins < 1110 THEN
    v_target_janela := 'tarde';
  ELSE
    v_target_janela := 'noturna';
  END IF;

  SELECT sub.fila_id, sub.profile_id, sub.auth_id
  INTO v_chosen_fila_id, v_chosen_profile_id, v_chosen_auth_id
  FROM (
    SELECT DISTINCT ON (rf.corretor_id)
      rf.id          AS fila_id,
      p.id           AS profile_id,
      p.user_id      AS auth_id,
      rf.corretor_id,
      rf.ultima_distribuicao_at,
      rc.created_at  AS cred_created
    FROM public.roleta_fila rf
    INNER JOIN public.roleta_credenciamentos rc
      ON rc.id = rf.credenciamento_id
    INNER JOIN public.profiles p
      ON p.id = rf.corretor_id
    LEFT JOIN public.corretor_disponibilidade cd
      ON cd.user_id = p.user_id
    WHERE rf.data = v_today_date
      AND rf.ativo = true
      AND rc.status = 'aprovado'
      AND rc.saiu_em IS NULL
      AND rc.data = v_today_date
      AND (cd.na_roleta IS NOT NULL AND cd.na_roleta = true)
      AND (
        v_segmento_id IS NULL
        OR v_ignora_segmento = true
        OR rf.segmento_id = v_segmento_id
        OR rf.segmento_id IS NULL
      )
      AND (
        v_is_special_day
        OR rf.janela = v_target_janela
        OR rf.janela = 'dia_todo'
      )
    ORDER BY rf.corretor_id, rf.ultima_distribuicao_at ASC NULLS FIRST
  ) sub
  ORDER BY sub.ultima_distribuicao_at ASC NULLS FIRST, sub.cred_created ASC
  LIMIT 1;

  IF v_chosen_auth_id IS NULL THEN
    NEW.aceite_status := 'pendente_distribuicao';
    RETURN NEW;
  END IF;

  NEW.corretor_id          := v_chosen_auth_id;
  NEW.aceite_status        := 'aguardando_aceite';
  NEW.distribuido_em       := v_now;
  NEW.aceite_expira_em     := v_now + interval '10 minutes';
  NEW.roleta_distribuido_em := v_now;

  INSERT INTO public.distribuicao_historico (pipeline_lead_id, corretor_id, acao, segmento_id)
  VALUES (NEW.id, v_chosen_auth_id, 'distribuido', v_segmento_id);

  INSERT INTO public.roleta_distribuicoes (lead_id, corretor_id, segmento_id, janela)
  VALUES (NEW.id, v_chosen_profile_id, v_segmento_id, v_target_janela)
  ON CONFLICT DO NOTHING;

  UPDATE public.roleta_fila
  SET leads_recebidos       = leads_recebidos + 1,
      ultima_distribuicao_at = v_now
  WHERE id = v_chosen_fila_id;

  UPDATE public.roleta_fila
  SET ultima_distribuicao_at = v_now
  WHERE data       = v_today_date
    AND corretor_id = v_chosen_profile_id
    AND id         <> v_chosen_fila_id;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Auto-distribute trigger error: %', SQLERRM;
  -- CORREÇÃO BUG #1: limpar TODOS os campos
  NEW.corretor_id           := NULL;
  NEW.aceite_status         := 'pendente_distribuicao';
  NEW.distribuido_em        := NULL;
  NEW.aceite_expira_em      := NULL;
  NEW.roleta_distribuido_em := NULL;
  RETURN NEW;
END;
$$;

-- ================================================================
-- PARTE 5: Recriar trigger com filtro BUG #4 no WHEN
-- ================================================================

DROP TRIGGER IF EXISTS trg_auto_distribute_new_lead ON pipeline_leads;

CREATE TRIGGER trg_auto_distribute_new_lead
  BEFORE INSERT ON pipeline_leads
  FOR EACH ROW
  WHEN (
    NEW.corretor_id IS NULL
    AND (NEW.aceite_status IS DISTINCT FROM 'pendente_distribuicao')
  )
  EXECUTE FUNCTION public.trg_auto_distribute_lead();
