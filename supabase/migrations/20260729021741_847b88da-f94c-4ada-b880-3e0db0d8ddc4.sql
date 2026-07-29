-- 1) Coluna client_ip_address
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS client_ip_address text;

-- 2) enqueue_meta_capi_event v4 — inclui client_ip_address no user_data (plain text)
CREATE OR REPLACE FUNCTION public.enqueue_meta_capi_event(
  p_lead_id uuid,
  p_event_name text,
  p_event_time timestamp with time zone DEFAULT now(),
  p_custom_data jsonb DEFAULT '{}'::jsonb,
  p_lead_event_source text DEFAULT 'uhome'::text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
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
  v_country_hash text;
  v_user_data   jsonb;
  v_payload     jsonb;
  v_nome_norm   text;
  v_first       text;
  v_last        text;
  v_cidade      text;
  v_uf          text;
BEGIN
  IF p_lead_id IS NULL OR p_event_name IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, email, telefone, meta_lead_id, nome, empreendimento,
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
    extract(epoch FROM p_event_time)::bigint::text
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
    'action_source', 'system_generated',
    'event_name',    p_event_name,
    'event_time',    extract(epoch FROM p_event_time)::bigint,
    'event_id',      v_event_id,
    'user_data',     v_user_data,
    'custom_data',   jsonb_build_object(
                       'event_source',      'crm',
                       'lead_event_source', COALESCE(p_lead_event_source, 'uhome')
                     ) || COALESCE(p_custom_data, '{}'::jsonb)
  );

  INSERT INTO public.meta_capi_queue (event_id, lead_id, event_name, event_time, payload)
  VALUES (v_event_id, p_lead_id, p_event_name, p_event_time, v_payload)
  ON CONFLICT (event_id) DO NOTHING;

  RETURN v_event_id;
END;
$function$;