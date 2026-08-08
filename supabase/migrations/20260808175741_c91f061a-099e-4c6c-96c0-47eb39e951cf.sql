CREATE OR REPLACE FUNCTION public.enqueue_meta_capi_event(p_lead_id uuid, p_event_name text, p_event_time timestamp with time zone DEFAULT now(), p_custom_data jsonb DEFAULT '{}'::jsonb, p_lead_event_source text DEFAULT 'uhome'::text, p_action_source text DEFAULT 'system_generated'::text, p_event_source_url text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_lead        record;
  v_event_id    text;
  v_email_hash  text;
  v_phone_hash  text;
  v_fn_hash     text;
  v_ln_hash     text;
  v_zp_hash     text;
  v_country_hash text;
  v_user_data   jsonb;
  v_payload     jsonb;
  v_nome_norm   text;
  v_first       text;
  v_last        text;
  v_ua          text;
  v_ip          text;
  v_time        timestamptz;
BEGIN
  IF p_lead_id IS NULL OR p_event_name IS NULL THEN
    RETURN NULL;
  END IF;

  v_time := COALESCE(p_event_time, now());
  -- Meta rejeita eventos com mais de 7 dias ("Invalid parameter")
  IF v_time < now() - interval '7 days' THEN
    RETURN NULL;
  END IF;
  IF v_time > now() THEN
    v_time := now();
  END IF;

  SELECT id, email, telefone, meta_lead_id, nome, empreendimento, cep,
         fbc, fbp, client_user_agent, client_ip_address, origem, created_at
    INTO v_lead
    FROM public.pipeline_leads
   WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- GUARDA: sem o lead_id do Meta o evento nao entra na fila.
  -- Conversao sem identificador de anuncio infla o volume e nao casa no Meta.
  -- O bloqueio e registrado para medicao (lead antigo = esperado;
  -- lead novo de origem Meta = bug de ingestao, e vira alerta).
  IF v_lead.meta_lead_id IS NULL OR btrim(v_lead.meta_lead_id) = '' THEN
    BEGIN
      INSERT INTO public.ops_events (fn, level, category, message, ctx)
      VALUES (
        'enqueue_meta_capi_event',
        'warn',
        'capi_bloqueado_sem_lead_id',
        format('CAPI bloqueado sem meta_lead_id: %s', p_event_name),
        jsonb_build_object(
          'lead_id_interno', p_lead_id,
          'event_name', p_event_name,
          'origem', v_lead.origem,
          'lead_created_at', v_lead.created_at
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- rastreamento nunca derruba a operacao do lead
    END;
    RETURN NULL;
  END IF;

  v_event_id := md5(
    p_lead_id::text || '|' || p_event_name || '|' ||
    COALESCE(p_lead_event_source, 'uhome') || '|' ||
    extract(epoch FROM v_time)::bigint::text
  );

  v_email_hash := public._capi_sha256(v_lead.email);
  v_phone_hash := public._capi_sha256(public._capi_normalize_phone(v_lead.telefone));

  v_nome_norm := lower(btrim(public.unaccent(COALESCE(v_lead.nome, ''))));
  IF v_nome_norm <> '' THEN
    IF position(' ' in v_nome_norm) > 0 THEN
      v_first := split_part(v_nome_norm, ' ', 1);
      v_last  := NULLIF(btrim(substring(v_nome_norm from position(' ' in v_nome_norm) + 1)), '');
    ELSE
      v_first := v_nome_norm;
      v_last  := NULL;
    END IF;
    v_fn_hash := public._capi_sha256_norm(v_first);
    v_ln_hash := public._capi_sha256_norm(v_last);
  END IF;

  -- ct/st NAO sao mais enviados: o cadastro nao guarda cidade/UF reais,
  -- e valor fixo ("porto alegre"/"rs") e dado falso.
  v_country_hash := public._capi_sha256_norm('br');
  v_zp_hash      := public._capi_sha256(NULLIF(regexp_replace(COALESCE(v_lead.cep, ''), '\D', '', 'g'), ''));

  v_user_data := '{}'::jsonb;
  IF v_email_hash IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('em', jsonb_build_array(v_email_hash));
  END IF;
  IF v_phone_hash IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('ph', jsonb_build_array(v_phone_hash));
  END IF;
  IF v_fn_hash IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('fn', jsonb_build_array(v_fn_hash));
  END IF;
  IF v_ln_hash IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('ln', jsonb_build_array(v_ln_hash));
  END IF;
  IF v_zp_hash IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('zp', jsonb_build_array(v_zp_hash));
  END IF;
  IF v_country_hash IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('country', jsonb_build_array(v_country_hash));
  END IF;

  v_user_data := v_user_data || jsonb_build_object('lead_id', btrim(v_lead.meta_lead_id));

  IF v_lead.fbc IS NOT NULL AND btrim(v_lead.fbc) <> '' THEN
    v_user_data := v_user_data || jsonb_build_object('fbc', v_lead.fbc);
  END IF;
  IF v_lead.fbp IS NOT NULL AND btrim(v_lead.fbp) <> '' THEN
    v_user_data := v_user_data || jsonb_build_object('fbp', v_lead.fbp);
  END IF;

  -- IP/UA so entram se forem do CLIENTE. Valores de servidor sao descartados.
  v_ua := NULLIF(btrim(COALESCE(v_lead.client_user_agent, '')), '');
  IF v_ua IS NOT NULL AND (
       v_ua ILIKE 'Deno/%' OR v_ua ILIKE '%SupabaseEdgeRuntime%' OR
       v_ua ILIKE 'Make/%' OR v_ua ILIKE '%node-fetch%' OR v_ua ILIKE '%axios/%' OR
       v_ua ILIKE '%curl/%' OR v_ua ILIKE '%python-requests%'
     ) THEN
    v_ua := NULL;
  END IF;
  IF v_ua IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('client_user_agent', v_ua);
  END IF;

  -- IP so acompanha um user agent de cliente valido; sozinho nao ajuda e pode ser do servidor.
  v_ip := NULLIF(btrim(COALESCE(v_lead.client_ip_address, '')), '');
  IF v_ua IS NOT NULL AND v_ip IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('client_ip_address', v_ip);
  END IF;

  v_payload := jsonb_build_object(
    'action_source', COALESCE(p_action_source, 'system_generated'),
    'event_name',    p_event_name,
    'event_time',    extract(epoch FROM v_time)::bigint,
    'event_id',      v_event_id,
    'user_data',     v_user_data,
    'custom_data',   jsonb_build_object(
                       'event_source',      'crm',
                       'lead_event_source', COALESCE(p_lead_event_source, 'uhome')
                     ) || COALESCE(p_custom_data, '{}'::jsonb)
  );

  IF p_event_source_url IS NOT NULL AND btrim(p_event_source_url) <> '' THEN
    v_payload := v_payload || jsonb_build_object('event_source_url', p_event_source_url);
  END IF;

  INSERT INTO public.meta_capi_queue (event_id, lead_id, event_name, event_time, payload)
  VALUES (v_event_id, p_lead_id, p_event_name, v_time, v_payload)
  ON CONFLICT (event_id) DO NOTHING;

  RETURN v_event_id;
END;
$function$;