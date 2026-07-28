
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Fila
CREATE TABLE IF NOT EXISTS public.meta_capi_queue (
  event_id     text PRIMARY KEY,
  lead_id      uuid,
  event_name   text NOT NULL,
  event_time   timestamptz NOT NULL DEFAULT now(),
  payload      jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','sent','failed','skipped')),
  attempts     int  NOT NULL DEFAULT 0,
  last_error   text,
  fbtrace_id   text,
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_capi_queue_status_created
  ON public.meta_capi_queue (status, created_at);
CREATE INDEX IF NOT EXISTS idx_meta_capi_queue_lead
  ON public.meta_capi_queue (lead_id);

GRANT ALL ON public.meta_capi_queue TO service_role;

ALTER TABLE public.meta_capi_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_capi_queue_service_role" ON public.meta_capi_queue;
CREATE POLICY "meta_capi_queue_service_role"
  ON public.meta_capi_queue FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 2. Helpers
CREATE OR REPLACE FUNCTION public._capi_sha256(p_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT CASE
    WHEN p_input IS NULL OR btrim(p_input) = '' THEN NULL
    ELSE encode(extensions.digest(lower(btrim(p_input)), 'sha256'), 'hex')
  END
$$;

CREATE OR REPLACE FUNCTION public._capi_normalize_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_phone IS NULL OR btrim(p_phone) = '' THEN NULL
    ELSE regexp_replace(p_phone, '\D', '', 'g')
  END
$$;

-- 3. enqueue
CREATE OR REPLACE FUNCTION public.enqueue_meta_capi_event(
  p_lead_id     uuid,
  p_event_name  text,
  p_event_time  timestamptz DEFAULT now(),
  p_custom_data jsonb       DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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

  v_event_id := md5(
    p_lead_id::text || '|' || p_event_name || '|' ||
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
                       'lead_event_source', 'uhome'
                     ) || COALESCE(p_custom_data, '{}'::jsonb)
  );

  INSERT INTO public.meta_capi_queue (event_id, lead_id, event_name, event_time, payload)
  VALUES (v_event_id, p_lead_id, p_event_name, p_event_time, v_payload)
  ON CONFLICT (event_id) DO NOTHING;

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_meta_capi_event(uuid, text, timestamptz, jsonb) TO service_role;

-- 4. Trigger pipeline_leads
CREATE OR REPLACE FUNCTION public._trg_pipeline_lead_capi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    v_event := CASE NEW.stage_id
      WHEN '1ea43190-44c8-43ec-91b4-409b055b0e58'::uuid THEN 'Lead'
      WHEN 'de6cee2f-8dda-4e60-a4e2-6b7f21aeae96'::uuid THEN 'SubmitApplication'
      WHEN '8c1eed68-4526-479f-9bb4-b8e70bee1416'::uuid THEN 'AddPaymentInfo'
      ELSE NULL
    END;
    IF v_event IS NOT NULL THEN
      PERFORM public.enqueue_meta_capi_event(NEW.id, v_event, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_lead_capi ON public.pipeline_leads;
CREATE TRIGGER trg_pipeline_lead_capi
  AFTER UPDATE OF stage_id ON public.pipeline_leads
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_pipeline_lead_capi();

-- 5. Trigger visitas
CREATE OR REPLACE FUNCTION public._trg_visita_capi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_visita_capi ON public.visitas;
CREATE TRIGGER trg_visita_capi
  AFTER INSERT OR UPDATE OF status ON public.visitas
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_visita_capi();

-- 6. Trigger negocios
CREATE OR REPLACE FUNCTION public._trg_negocio_capi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_negocio_capi ON public.negocios;
CREATE TRIGGER trg_negocio_capi
  AFTER INSERT OR UPDATE OF fase ON public.negocios
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_negocio_capi();
