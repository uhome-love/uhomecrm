
-- A1: colunas de rastreamento
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS fbc TEXT,
  ADD COLUMN IF NOT EXISTS fbp TEXT,
  ADD COLUMN IF NOT EXISTS client_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS event_source_url TEXT;

-- A1: enqueue_meta_capi_event lê as novas colunas
CREATE OR REPLACE FUNCTION public.enqueue_meta_capi_event(
  p_lead_id uuid,
  p_event_name text,
  p_event_time timestamp with time zone DEFAULT now(),
  p_custom_data jsonb DEFAULT '{}'::jsonb,
  p_lead_event_source text DEFAULT 'uhome'
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
  v_user_data   jsonb;
  v_payload     jsonb;
  v_action_src  text;
BEGIN
  IF p_lead_id IS NULL OR p_event_name IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, email, telefone, meta_lead_id,
         fbc, fbp, client_user_agent, event_source_url
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

  v_user_data := '{}'::jsonb;
  IF v_email_hash IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('em', jsonb_build_array(v_email_hash));
  END IF;
  IF v_phone_hash IS NOT NULL THEN
    v_user_data := v_user_data || jsonb_build_object('ph', jsonb_build_array(v_phone_hash));
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

  -- action_source: 'website' quando há contexto de navegador; senão 'system_generated'
  IF (v_lead.fbc IS NOT NULL AND btrim(v_lead.fbc) <> '')
     OR (v_lead.fbp IS NOT NULL AND btrim(v_lead.fbp) <> '') THEN
    v_action_src := 'website';
  ELSE
    v_action_src := 'system_generated';
  END IF;

  v_payload := jsonb_build_object(
    'action_source', v_action_src,
    'event_name',    p_event_name,
    'event_time',    extract(epoch FROM p_event_time)::bigint,
    'event_id',      v_event_id,
    'user_data',     v_user_data,
    'custom_data',   jsonb_build_object(
                       'event_source',      'crm',
                       'lead_event_source', COALESCE(p_lead_event_source, 'uhome')
                     ) || COALESCE(p_custom_data, '{}'::jsonb)
  );

  IF v_lead.event_source_url IS NOT NULL AND btrim(v_lead.event_source_url) <> '' THEN
    v_payload := v_payload || jsonb_build_object('event_source_url', v_lead.event_source_url);
  END IF;

  INSERT INTO public.meta_capi_queue (event_id, lead_id, event_name, event_time, payload)
  VALUES (v_event_id, p_lead_id, p_event_name, p_event_time, v_payload)
  ON CONFLICT (event_id) DO NOTHING;

  RETURN v_event_id;
END;
$function$;
