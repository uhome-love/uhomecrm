
-- 1) Dedup roleta_fila per (corretor, segmento, janela, data)
WITH dups AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY corretor_id, COALESCE(segmento_id::text,'_'), janela, data
      ORDER BY posicao ASC, id ASC
    ) AS rn
  FROM public.roleta_fila WHERE ativo = true
)
UPDATE public.roleta_fila SET ativo = false
WHERE id IN (SELECT id FROM dups WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roleta_fila_corretor_seg_janela_data_ativo
ON public.roleta_fila (corretor_id, COALESCE(segmento_id::text,'_'), janela, data)
WHERE ativo = true;

-- 2) Expiration function
CREATE OR REPLACE FUNCTION public.expirar_aceites_roleta()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INT := 0;
  v_lead RECORD;
BEGIN
  FOR v_lead IN
    SELECT pl.id, pl.corretor_id
    FROM public.pipeline_leads pl
    WHERE pl.aceite_status = 'aguardando_aceite'
      AND pl.aceite_expira_em IS NOT NULL
      AND pl.aceite_expira_em < (now() - interval '30 seconds')
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.roleta_distribuicoes
       SET status = 'expirado'
     WHERE lead_id = v_lead.id AND status = 'aguardando';

    UPDATE public.pipeline_leads
       SET aceite_status = 'pendente_distribuicao',
           corretor_id   = NULL,
           distribuido_em = NULL,
           aceite_expira_em = NULL,
           updated_at = now()
     WHERE id = v_lead.id;

    INSERT INTO public.distribuicao_historico (pipeline_lead_id, corretor_id, acao, motivo_rejeicao, created_at)
    VALUES (v_lead.id, v_lead.corretor_id, 'timeout', 'sla_expirado', now());

    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('expired', v_count, 'at', now());
END;
$$;

-- 3) Sync trigger
CREATE OR REPLACE FUNCTION public.sync_aceite_status_to_distribuicao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.aceite_status IS DISTINCT FROM OLD.aceite_status THEN
    IF NEW.aceite_status = 'aceito' THEN
      UPDATE public.roleta_distribuicoes
         SET status = 'aceito', aceito_em = COALESCE(aceito_em, now())
       WHERE lead_id = NEW.id AND status = 'aguardando';
    ELSIF NEW.aceite_status IN ('pendente_distribuicao','timeout') THEN
      UPDATE public.roleta_distribuicoes
         SET status = CASE WHEN NEW.aceite_status = 'timeout' THEN 'expirado' ELSE 'recusado' END
       WHERE lead_id = NEW.id AND status = 'aguardando';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_aceite_status_to_distribuicao ON public.pipeline_leads;
CREATE TRIGGER trg_sync_aceite_status_to_distribuicao
AFTER UPDATE OF aceite_status ON public.pipeline_leads
FOR EACH ROW EXECUTE FUNCTION public.sync_aceite_status_to_distribuicao();

-- 4) Round-robin determinístico
CREATE OR REPLACE FUNCTION public.distribuir_lead_atomico(p_lead_id uuid, p_janela text DEFAULT NULL::text, p_exclude_auth_user_id uuid DEFAULT NULL::uuid, p_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_now TIMESTAMPTZ := now();
  v_expire_at TIMESTAMPTZ;
  v_emp_lower TEXT;
  v_brt_hour NUMERIC;
  v_brt_minute NUMERIC;
  v_brt_mins NUMERIC;
  v_origens_gerais TEXT[];
  v_avulso_segmento_id UUID := '5311aaaa-0000-4000-8000-000000000003';
  v_lead_origem_lower TEXT;
  v_total_fila INT;
  v_failure_reason TEXT;
  v_matched_campaign BOOLEAN := FALSE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('distribuir_lead_atomico'));
  SELECT id, nome, telefone, empreendimento, aceite_status, corretor_id, origem
  INTO v_lead FROM public.pipeline_leads WHERE id = p_lead_id FOR UPDATE;
  IF v_lead IS NULL THEN RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found'); END IF;
  IF v_lead.corretor_id IS NOT NULL AND v_lead.aceite_status NOT IN ('pendente_distribuicao','timeout') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;
  SELECT string_to_array(valor, ',') INTO v_origens_gerais FROM public.roleta_config WHERE chave = 'origens_gerais';
  IF v_origens_gerais IS NULL THEN v_origens_gerais := ARRAY['jetimob']; END IF;
  v_lead_origem_lower := lower(trim(COALESCE(v_lead.origem,'')));
  v_emp_lower := lower(trim(COALESCE(v_lead.empreendimento,'')));
  IF v_emp_lower <> '' THEN
    SELECT segmento_id, COALESCE(ignorar_segmento,false) INTO v_segmento_id, v_ignora_segmento_camp
    FROM public.roleta_campanhas WHERE ativo = true
      AND (lower(trim(empreendimento)) = v_emp_lower
           OR v_emp_lower LIKE '%'||lower(trim(empreendimento))||'%'
           OR lower(trim(empreendimento)) LIKE '%'||v_emp_lower||'%') LIMIT 1;
    IF v_segmento_id IS NOT NULL OR v_ignora_segmento_camp THEN v_matched_campaign := TRUE; END IF;
    IF v_ignora_segmento_camp THEN v_segmento_id := NULL; v_ignora_segmento := TRUE; END IF;
  END IF;
  IF NOT v_matched_campaign AND v_lead_origem_lower = ANY(v_origens_gerais) THEN
    v_segmento_id := NULL; v_ignora_segmento := TRUE;
  ELSIF NOT v_matched_campaign THEN
    v_segmento_id := v_avulso_segmento_id; v_ignora_segmento := FALSE;
  END IF;
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
  SELECT sub.fila_id, sub.profile_id, sub.auth_id INTO v_chosen_fila_id, v_chosen_profile_id, v_chosen_auth_id FROM (
    SELECT DISTINCT ON (rf.corretor_id) rf.id AS fila_id, p.id AS profile_id, p.user_id AS auth_id,
      rf.corretor_id, rf.ultima_distribuicao_at, COALESCE(rf.leads_recebidos,0) AS leads_recebidos, rc.created_at AS cred_created
    FROM public.roleta_fila rf
    INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
    INNER JOIN public.profiles p ON p.id = rf.corretor_id
    LEFT JOIN public.corretor_disponibilidade cd ON cd.user_id = p.user_id
    WHERE rc.status = 'aprovado' AND rc.data = v_today_date
      AND (rc.janela = v_target_janela OR rc.janela = 'dia_todo' OR v_target_janela = 'dia_todo')
      AND (v_ignora_segmento OR rc.segmento_1_id = v_segmento_id OR rc.segmento_2_id = v_segmento_id)
      AND (p_exclude_auth_user_id IS NULL OR p.user_id <> p_exclude_auth_user_id)
      AND COALESCE(cd.na_roleta, true) = true AND COALESCE(rf.ativo, true) = true
    ORDER BY rf.corretor_id, rf.ultima_distribuicao_at NULLS FIRST, rc.created_at ASC, rf.id ASC
  ) sub
  ORDER BY sub.ultima_distribuicao_at NULLS FIRST, sub.leads_recebidos ASC, sub.cred_created ASC, sub.fila_id ASC
  LIMIT 1;
  IF v_chosen_fila_id IS NULL THEN
    SELECT count(*) INTO v_total_fila FROM public.roleta_fila rf
      INNER JOIN public.roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
      WHERE rc.status = 'aprovado' AND rc.data = v_today_date;
    IF v_total_fila = 0 THEN v_failure_reason := 'no_fila_active'; ELSE v_failure_reason := 'no_broker_available'; END IF;
    RETURN jsonb_build_object('success', false, 'reason', v_failure_reason,
      'segmento_id', v_segmento_id, 'janela', v_target_janela, 'total_fila_today', v_total_fila);
  END IF;
  UPDATE public.pipeline_leads SET corretor_id = v_chosen_auth_id, aceite_status = 'aguardando_aceite',
    aceite_expira_em = v_expire_at, distribuido_em = v_now, updated_at = v_now WHERE id = p_lead_id;
  UPDATE public.roleta_fila
    SET ultima_distribuicao_at = v_now,
        leads_recebidos = COALESCE(leads_recebidos, 0) + 1
  WHERE id = v_chosen_fila_id;
  INSERT INTO public.roleta_distribuicoes (lead_id, corretor_id, segmento_id, janela, enviado_em, expira_em, status)
  VALUES (p_lead_id, v_chosen_profile_id, v_segmento_id, v_target_janela, v_now, v_expire_at, 'aguardando');
  INSERT INTO public.distribuicao_historico (pipeline_lead_id, corretor_id, segmento_id, acao, created_at)
  VALUES (p_lead_id, v_chosen_auth_id, v_segmento_id, 'distribuido', v_now);
  RETURN jsonb_build_object('success', true, 'corretor_id', v_chosen_auth_id, 'profile_id', v_chosen_profile_id,
    'segmento_id', v_segmento_id, 'janela', v_target_janela, 'expira_em', v_expire_at);
END;
$function$;
