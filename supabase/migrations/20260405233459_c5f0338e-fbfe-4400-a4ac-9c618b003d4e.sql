
-- The AFTER INSERT trigger calling distribuir_lead_atomico directly will hit
-- a deadlock because the RPC does SELECT FOR UPDATE on the same row being inserted.
-- Solution: Use a simpler approach - set the fields directly in the trigger BEFORE INSERT,
-- finding the next broker without locking the lead row.

CREATE OR REPLACE FUNCTION public.trg_auto_distribute_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_segmento_id UUID;
  v_ignora_segmento BOOLEAN := FALSE;
  v_target_janela TEXT;
  v_today_date DATE;
  v_today_start TIMESTAMPTZ;
  v_is_sunday BOOLEAN;
  v_is_holiday BOOLEAN := FALSE;
  v_is_special_day BOOLEAN;
  v_chosen_fila_id UUID;
  v_chosen_profile_id UUID;
  v_chosen_auth_id UUID;
  v_now TIMESTAMPTZ := now();
  v_emp_lower TEXT;
  v_brt_hour NUMERIC;
  v_brt_minute NUMERIC;
  v_brt_mins NUMERIC;
  v_origens_gerais TEXT[];
  v_lead_origem_lower TEXT;
BEGIN
  -- Only for leads without a corretor
  IF NEW.corretor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve origens gerais
  SELECT string_to_array(valor, ',') INTO v_origens_gerais
  FROM public.roleta_config WHERE chave = 'origens_gerais';
  IF v_origens_gerais IS NULL THEN
    v_origens_gerais := ARRAY['site', 'site_uhome', 'imovelweb', 'jetimob'];
  END IF;

  v_lead_origem_lower := lower(trim(COALESCE(NEW.origem, '')));

  IF v_lead_origem_lower = ANY(v_origens_gerais) THEN
    v_ignora_segmento := TRUE;
  END IF;

  -- Resolve segmento
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
    v_segmento_id := NULL;
    v_ignora_segmento := TRUE;
  END IF;

  IF v_emp_lower = '' THEN
    v_ignora_segmento := TRUE;
    v_segmento_id := NULL;
  END IF;

  -- Resolve janela
  v_today_date := (v_now AT TIME ZONE 'America/Sao_Paulo')::date;
  v_today_start := (date_trunc('day', v_now AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo';
  v_is_sunday := EXTRACT(DOW FROM (v_now AT TIME ZONE 'America/Sao_Paulo')) = 0;
  SELECT EXISTS(SELECT 1 FROM public.feriados WHERE data = v_today_date) INTO v_is_holiday;
  v_is_special_day := v_is_sunday OR v_is_holiday;

  v_brt_hour := EXTRACT(HOUR FROM (v_now AT TIME ZONE 'America/Sao_Paulo'));
  v_brt_minute := EXTRACT(MINUTE FROM (v_now AT TIME ZONE 'America/Sao_Paulo'));
  v_brt_mins := v_brt_hour * 60 + v_brt_minute;

  IF v_is_special_day THEN
    v_target_janela := 'dia_todo';
  ELSIF v_brt_mins < 720 THEN
    v_target_janela := 'manha';
  ELSIF v_brt_mins < 1110 THEN
    v_target_janela := 'tarde';
  ELSE
    v_target_janela := 'noturna';
  END IF;

  -- Find next broker (pure round-robin)
  SELECT rf.id, p.id, p.user_id
  INTO v_chosen_fila_id, v_chosen_profile_id, v_chosen_auth_id
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
  ORDER BY
    rf.ultima_distribuicao_at ASC NULLS FIRST,
    rc.created_at ASC
  LIMIT 1;

  -- If no broker found, leave as pendente_distribuicao (CEO queue)
  IF v_chosen_auth_id IS NULL THEN
    NEW.aceite_status := 'pendente_distribuicao';
    RETURN NEW;
  END IF;

  -- Assign directly on the NEW record (BEFORE INSERT)
  NEW.corretor_id := v_chosen_auth_id;
  NEW.aceite_status := 'aguardando_aceite';
  NEW.distribuido_em := v_now;
  NEW.aceite_expira_em := v_now + interval '10 minutes';
  NEW.roleta_distribuido_em := v_now;

  -- Record distribution history
  INSERT INTO public.distribuicao_historico (pipeline_lead_id, corretor_id, acao, segmento_id)
  VALUES (NEW.id, v_chosen_auth_id, 'distribuido', v_segmento_id);

  INSERT INTO public.roleta_distribuicoes (lead_id, corretor_id, segmento_id, janela)
  VALUES (NEW.id, v_chosen_profile_id, v_segmento_id, v_target_janela)
  ON CONFLICT DO NOTHING;

  -- Update round-robin pointer
  UPDATE public.roleta_fila
  SET leads_recebidos = leads_recebidos + 1,
      ultima_distribuicao_at = v_now
  WHERE id = v_chosen_fila_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Auto-distribute trigger error: %', SQLERRM;
  NEW.aceite_status := 'pendente_distribuicao';
  RETURN NEW;
END;
$$;

-- Change to BEFORE INSERT trigger so we can modify NEW directly
DROP TRIGGER IF EXISTS trg_auto_distribute_new_lead ON public.pipeline_leads;
CREATE TRIGGER trg_auto_distribute_new_lead
  BEFORE INSERT ON public.pipeline_leads
  FOR EACH ROW
  WHEN (NEW.corretor_id IS NULL)
  EXECUTE FUNCTION public.trg_auto_distribute_lead();
