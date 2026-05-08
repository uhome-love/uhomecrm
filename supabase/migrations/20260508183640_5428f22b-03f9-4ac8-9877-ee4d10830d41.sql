-- Alinhar regras de elegibilidade do trigger BEFORE INSERT com a função distribuir_lead_atomico.
-- Motivo: leads estavam caindo na fila CEO mesmo havendo corretores ativos no segmento, porque
-- o trigger usava critérios mais restritivos (rf.segmento_id e cd.na_roleta NOT NULL) que a RPC.

CREATE OR REPLACE FUNCTION public.trg_auto_distribute_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_segmento_id        UUID;
  v_ignora_segmento    BOOLEAN := FALSE;
  v_ignora_segmento_camp BOOLEAN := FALSE;
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
  v_avulso_segmento_id UUID := '5311aaaa-0000-4000-8000-000000000003';
  v_matched_campaign   BOOLEAN := FALSE;
BEGIN
  -- Leads marcados explicitamente como pendente_distribuicao não são auto-distribuidos
  IF NEW.aceite_status = 'pendente_distribuicao' THEN
    RETURN NEW;
  END IF;

  IF NEW.corretor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('distribuir_lead'));

  -- ----------------------------------------------------------------
  -- Resolução de segmento (espelha distribuir_lead_atomico)
  -- ----------------------------------------------------------------
  SELECT string_to_array(valor, ',') INTO v_origens_gerais
  FROM public.roleta_config WHERE chave = 'origens_gerais';
  IF v_origens_gerais IS NULL THEN
    v_origens_gerais := ARRAY['jetimob'];
  END IF;

  v_lead_origem_lower := lower(trim(COALESCE(NEW.origem, '')));
  v_emp_lower         := lower(trim(COALESCE(NEW.empreendimento, '')));

  IF v_emp_lower <> '' THEN
    SELECT segmento_id, COALESCE(ignorar_segmento, false)
    INTO v_segmento_id, v_ignora_segmento_camp
    FROM public.roleta_campanhas
    WHERE ativo = true
      AND (
        lower(trim(empreendimento)) = v_emp_lower
        OR v_emp_lower LIKE '%' || lower(trim(empreendimento)) || '%'
        OR lower(trim(empreendimento)) LIKE '%' || v_emp_lower || '%'
      )
    LIMIT 1;
    IF v_segmento_id IS NOT NULL OR v_ignora_segmento_camp THEN
      v_matched_campaign := TRUE;
    END IF;
    IF v_ignora_segmento_camp THEN
      v_segmento_id := NULL; v_ignora_segmento := TRUE;
    END IF;
  END IF;

  IF NOT v_matched_campaign AND v_lead_origem_lower = ANY(v_origens_gerais) THEN
    v_segmento_id := NULL; v_ignora_segmento := TRUE;
  ELSIF NOT v_matched_campaign THEN
    -- Fallback universal para segmento Avulso (mesmo critério da RPC)
    v_segmento_id := v_avulso_segmento_id; v_ignora_segmento := FALSE;
  END IF;

  -- ----------------------------------------------------------------
  -- Janela atual (BRT)
  -- ----------------------------------------------------------------
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

  -- ----------------------------------------------------------------
  -- Seleção do corretor (regras alinhadas com distribuir_lead_atomico)
  --   - usa segmentos do CREDENCIAMENTO (segmento_1_id OU segmento_2_id)
  --   - aceita corretores sem linha em corretor_disponibilidade (COALESCE true)
  --   - round-robin por menor recebidos_no_turno
  -- ----------------------------------------------------------------
  WITH eligiveis AS (
    SELECT rf.id AS fila_id, p.id AS profile_id, p.user_id AS auth_id, rf.corretor_id,
           rf.ultima_distribuicao_at, COALESCE(rf.leads_recebidos,0) AS leads_recebidos,
           (
             SELECT count(*) FROM public.roleta_distribuicoes rd
             WHERE rd.corretor_id = p.id
               AND rd.janela = v_target_janela
               AND rd.enviado_em >= (v_today_date::timestamp AT TIME ZONE 'America/Sao_Paulo')
               AND rd.enviado_em <  ((v_today_date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
               AND (v_ignora_segmento OR rd.segmento_id = v_segmento_id OR rd.segmento_id IS NULL)
           ) AS recebidos_no_turno
    FROM public.roleta_fila rf
    INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
    INNER JOIN public.profiles p ON p.id = rf.corretor_id
    LEFT JOIN public.corretor_disponibilidade cd ON cd.user_id = p.user_id
    WHERE rc.status = 'aprovado' AND rc.data = v_today_date
      AND (rc.janela = v_target_janela OR rc.janela = 'dia_todo' OR v_target_janela = 'dia_todo')
      AND (v_ignora_segmento OR rc.segmento_1_id = v_segmento_id OR rc.segmento_2_id = v_segmento_id)
      AND COALESCE(cd.na_roleta, true) = true
      AND COALESCE(rf.ativo, true) = true
  ),
  filtrados AS (
    SELECT * FROM eligiveis
    WHERE recebidos_no_turno = (SELECT MIN(recebidos_no_turno) FROM eligiveis)
  )
  SELECT sub.fila_id, sub.profile_id, sub.auth_id
  INTO v_chosen_fila_id, v_chosen_profile_id, v_chosen_auth_id
  FROM (
    SELECT DISTINCT ON (corretor_id) fila_id, profile_id, auth_id, corretor_id,
           ultima_distribuicao_at, leads_recebidos, recebidos_no_turno
    FROM filtrados
    ORDER BY corretor_id, ultima_distribuicao_at NULLS FIRST, leads_recebidos ASC, fila_id ASC
  ) sub
  ORDER BY sub.recebidos_no_turno ASC, sub.ultima_distribuicao_at NULLS FIRST, sub.leads_recebidos ASC, sub.fila_id ASC
  LIMIT 1;

  IF v_chosen_auth_id IS NULL THEN
    -- Sem corretor elegível: lead vai para fila CEO (regra correta — única condição válida)
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
  SET leads_recebidos       = COALESCE(leads_recebidos,0) + 1,
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
  NEW.corretor_id           := NULL;
  NEW.aceite_status         := 'pendente_distribuicao';
  NEW.distribuido_em        := NULL;
  NEW.aceite_expira_em      := NULL;
  NEW.roleta_distribuido_em := NULL;
  RETURN NEW;
END;
$function$;