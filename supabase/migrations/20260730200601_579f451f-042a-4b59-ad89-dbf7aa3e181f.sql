ALTER TABLE public.pipeline_leads ADD COLUMN IF NOT EXISTS cep text;

CREATE OR REPLACE FUNCTION public.enqueue_meta_capi_event(
  p_lead_id uuid,
  p_event_name text,
  p_event_time timestamp with time zone DEFAULT now(),
  p_custom_data jsonb DEFAULT '{}'::jsonb,
  p_lead_event_source text DEFAULT 'uhome'::text,
  p_action_source text DEFAULT 'system_generated'::text,
  p_event_source_url text DEFAULT NULL::text
)
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
  v_ct_hash     text;
  v_st_hash     text;
  v_zp_hash     text;
  v_country_hash text;
  v_user_data   jsonb;
  v_payload     jsonb;
  v_nome_norm   text;
  v_first       text;
  v_last        text;
  v_cidade      text;
  v_uf          text;
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
         fbc, fbp, client_user_agent, client_ip_address
    INTO v_lead
    FROM public.pipeline_leads
   WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_lead.email IS NULL AND v_lead.telefone IS NULL AND v_lead.meta_lead_id IS NULL THEN
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

  v_cidade := 'porto alegre';
  v_uf     := 'rs';

  v_ct_hash      := public._capi_sha256_norm(v_cidade);
  v_st_hash      := public._capi_sha256_norm(v_uf);
  v_country_hash := public._capi_sha256_norm('br');
  v_zp_hash      := public._capi_sha256(regexp_replace(COALESCE(v_lead.cep, ''), '\D', '', 'g'));

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
  IF v_ct_hash IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('ct', jsonb_build_array(v_ct_hash));
  END IF;
  IF v_st_hash IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('st', jsonb_build_array(v_st_hash));
  END IF;
  IF v_zp_hash IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('zp', jsonb_build_array(v_zp_hash));
  END IF;
  IF v_country_hash IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('country', jsonb_build_array(v_country_hash));
  END IF;
  IF v_lead.meta_lead_id IS NOT NULL AND btrim(v_lead.meta_lead_id) <> '' THEN
    v_user_data := v_user_data || jsonb_build_object('lead_id', v_lead.meta_lead_id);
  END IF;
  IF v_lead.fbc IS NOT NULL AND btrim(v_lead.fbc) <> '' THEN
    v_user_data := v_user_data || jsonb_build_object('fbc', v_lead.fbc);
  END IF;
  IF v_lead.fbp IS NOT NULL AND btrim(v_lead.fbp) <> '' THEN
    v_user_data := v_user_data || jsonb_build_object('fbp', v_lead.fbp);
  END IF;
  IF v_lead.client_user_agent IS NOT NULL AND btrim(v_lead.client_user_agent) <> '' THEN
    v_user_data := v_user_data || jsonb_build_object('client_user_agent', v_lead.client_user_agent);
  END IF;
  IF v_lead.client_ip_address IS NOT NULL AND btrim(v_lead.client_ip_address) <> '' THEN
    v_user_data := v_user_data || jsonb_build_object('client_ip_address', v_lead.client_ip_address);
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

-- Triggers passam a usar sempre o horário atual
CREATE OR REPLACE FUNCTION public._trg_negocio_capi()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_value numeric;
  v_custom jsonb;
BEGIN
  IF NEW.pipeline_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.fase = 'ganho' AND (TG_OP = 'INSERT' OR OLD.fase IS DISTINCT FROM 'ganho') THEN
    v_value := COALESCE(NEW.vgv_final, NEW.vgv_estimado, 0);
    v_custom := jsonb_build_object(
      'value', v_value,
      'currency', 'BRL',
      'negocio_id', NEW.id,
      'empreendimento', NEW.empreendimento
    );
    PERFORM public.enqueue_meta_capi_event(NEW.pipeline_lead_id, 'Purchase', now(), v_custom);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public._trg_visita_capi()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event text;
  v_custom jsonb;
BEGIN
  IF NEW.pipeline_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'marcada' THEN
      v_event := 'Schedule';
      v_custom := jsonb_build_object(
        'visita_id', NEW.id,
        'data_visita', NEW.data_visita,
        'empreendimento', NEW.empreendimento
      );
    ELSIF NEW.status = 'realizada' THEN
      v_event := 'ViewContent';
      v_custom := jsonb_build_object(
        'content_type', 'visita_realizada',
        'visita_id', NEW.id,
        'empreendimento', NEW.empreendimento
      );
    ELSE
      v_event := NULL;
    END IF;

    IF v_event IS NOT NULL THEN
      PERFORM public.enqueue_meta_capi_event(NEW.pipeline_lead_id, v_event, now(), v_custom);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;