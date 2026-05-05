CREATE OR REPLACE FUNCTION public.distribuir_lead_atomico(p_lead_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead RECORD;
  v_segmento_id uuid;
  v_segmento_nome text;
  v_target_janela text;
  v_now timestamptz := now();
  v_brt_now timestamptz := (now() AT TIME ZONE 'America/Sao_Paulo');
  v_hora int;
  v_chosen_fila_id uuid;
  v_chosen_corretor_id uuid;
  v_chosen_profile_id uuid;
  v_expire_at timestamptz;
  v_origem_lower text;
  v_emp_lower text;
  v_ignorar_segmento boolean := false;
BEGIN
  SELECT id, nome, telefone, empreendimento, aceite_status, corretor_id, origem
    INTO v_lead
    FROM public.pipeline_leads
   WHERE id = p_lead_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF v_lead.corretor_id IS NOT NULL AND v_lead.aceite_status NOT IN ('pendente_distribuicao', 'timeout') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;

  v_origem_lower := lower(coalesce(v_lead.origem, ''));
  v_emp_lower := lower(coalesce(v_lead.empreendimento, ''));

  -- Resolve segment STRICTLY via roleta_campanhas (single source of truth)
  IF v_emp_lower = '' OR v_emp_lower = 'geral' THEN
    v_ignorar_segmento := true;
  ELSE
    SELECT rc.segmento_id, rs.nome, rc.ignorar_segmento
      INTO v_segmento_id, v_segmento_nome, v_ignorar_segmento
      FROM public.roleta_campanhas rc
      JOIN public.roleta_segmentos rs ON rs.id = rc.segmento_id
     WHERE lower(rc.empreendimento) = v_emp_lower
       AND rc.ativo = true
     LIMIT 1;

    -- Fallback: site/imovelweb/portal -> S3 Avulso
    IF v_segmento_id IS NULL AND (v_origem_lower IN ('imovelweb','site_uhome','site') OR v_origem_lower LIKE '%site%' OR v_origem_lower LIKE '%imovelweb%') THEN
      SELECT id, nome INTO v_segmento_id, v_segmento_nome
        FROM public.roleta_segmentos
       WHERE lower(nome) LIKE '%avulso%' OR nome ILIKE 'S3%'
       ORDER BY nome
       LIMIT 1;
      v_ignorar_segmento := false;
    END IF;

    -- If still nothing matched, treat as general (avoid losing the lead)
    IF v_segmento_id IS NULL THEN
      v_ignorar_segmento := true;
    END IF;
  END IF;

  -- Determine janela by current BRT hour
  v_hora := EXTRACT(HOUR FROM v_brt_now)::int;
  IF v_hora >= 8 AND v_hora < 12 THEN
    v_target_janela := 'manha';
  ELSIF v_hora >= 12 AND v_hora < 18 THEN
    v_target_janela := 'tarde';
  ELSE
    v_target_janela := 'noite';
  END IF;

  -- Pick next broker via roleta_fila (round-robin by ultima_distribuicao_at)
  IF v_ignorar_segmento THEN
    SELECT rf.id, rf.corretor_id INTO v_chosen_fila_id, v_chosen_corretor_id
      FROM public.roleta_fila rf
     WHERE rf.janela = v_target_janela
       AND rf.ativo = true
     ORDER BY rf.ultima_distribuicao_at NULLS FIRST, rf.created_at
     LIMIT 1;
  ELSE
    SELECT rf.id, rf.corretor_id INTO v_chosen_fila_id, v_chosen_corretor_id
      FROM public.roleta_fila rf
     WHERE rf.segmento_id = v_segmento_id
       AND rf.janela = v_target_janela
       AND rf.ativo = true
     ORDER BY rf.ultima_distribuicao_at NULLS FIRST, rf.created_at
     LIMIT 1;
  END IF;

  IF v_chosen_corretor_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'no_broker_available',
      'segmento_id', v_segmento_id,
      'janela', v_target_janela
    );
  END IF;

  SELECT user_id INTO v_chosen_profile_id
    FROM public.profiles
   WHERE id = v_chosen_corretor_id;

  IF v_chosen_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_user_id_missing');
  END IF;

  v_expire_at := v_now + interval '10 minutes';

  UPDATE public.pipeline_leads
     SET corretor_id = v_chosen_profile_id,
         aceite_status = 'aguardando_aceite',
         aceite_expira_em = v_expire_at,
         distribuido_em = v_now,
         updated_at = v_now
   WHERE id = p_lead_id;

  UPDATE public.roleta_fila
     SET ultima_distribuicao_at = v_now
   WHERE id = v_chosen_fila_id;

  INSERT INTO public.roleta_distribuicoes (lead_id, corretor_id, segmento_id, janela, enviado_em, expira_em, status)
  VALUES (p_lead_id, v_chosen_profile_id, v_segmento_id, v_target_janela, v_now, v_expire_at, 'aguardando');

  RETURN jsonb_build_object(
    'success', true,
    'corretor_id', v_chosen_profile_id,
    'segmento_id', v_segmento_id,
    'segmento_nome', v_segmento_nome,
    'janela', v_target_janela,
    'expira_em', v_expire_at
  );
END;
$function$;