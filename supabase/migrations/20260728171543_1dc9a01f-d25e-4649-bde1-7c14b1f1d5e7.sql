
-- ============================================================
-- B1: enqueue_meta_capi_event com override de lead_event_source
-- ============================================================
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
BEGIN
  IF p_lead_id IS NULL OR p_event_name IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, email, telefone, meta_lead_id
    INTO v_lead
    FROM public.pipeline_leads
   WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_lead.email IS NULL AND v_lead.telefone IS NULL AND v_lead.meta_lead_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- event_id inclui lead_event_source para permitir 2 eventos "Lead" distintos
  -- (criação com 'uhome CRM' + qualificação com 'Qualificado')
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

-- ============================================================
-- B3: _trg_pipeline_lead_capi — só Qualificação = 'Lead'/'Qualificado'
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_pipeline_lead_capi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Qualificação: Lead com lead_event_source='Qualificado'
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id
     AND NEW.stage_id = 'de6cee2f-8dda-4e60-a4e2-6b7f21aeae96'::uuid THEN
    PERFORM public.enqueue_meta_capi_event(
      NEW.id, 'Lead', now(), '{}'::jsonb, 'Qualificado'
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- B2: Trigger de criação de lead → evento "Lead" (uhome CRM)
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_pipeline_lead_capi_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Guardrails: precisa de algum identificador e não pode estar arquivado
  IF COALESCE(NEW.arquivado, false) = true THEN
    RETURN NEW;
  END IF;

  IF NEW.email IS NULL AND NEW.telefone IS NULL AND NEW.meta_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.enqueue_meta_capi_event(
    NEW.id, 'Lead', now(), '{}'::jsonb, 'uhome CRM'
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pipeline_lead_capi_insert ON public.pipeline_leads;
CREATE TRIGGER trg_pipeline_lead_capi_insert
AFTER INSERT ON public.pipeline_leads
FOR EACH ROW EXECUTE FUNCTION public._trg_pipeline_lead_capi_insert();
