DROP FUNCTION IF EXISTS public.enqueue_meta_capi_event(uuid, text, timestamptz, jsonb, text);

CREATE OR REPLACE FUNCTION public._trg_pipeline_lead_capi_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.arquivado, false) = true THEN
    RETURN NEW;
  END IF;

  IF NEW.email IS NULL AND NEW.telefone IS NULL AND NEW.meta_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.enqueue_meta_capi_event(
      p_lead_id => NEW.id,
      p_event_name => 'Lead',
      p_event_time => now(),
      p_custom_data => '{}'::jsonb,
      p_lead_event_source => 'uhome CRM'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.ops_events (fn, level, category, message, ctx, error_detail)
    VALUES ('trg_pipeline_lead_capi_insert', 'warn', 'capi',
            'capi_enqueue_failed_ignored',
            jsonb_build_object('lead_id', NEW.id, 'event', 'Lead'),
            SQLSTATE || ': ' || SQLERRM);
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_pipeline_lead_capi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id
     AND NEW.stage_id = 'de6cee2f-8dda-4e60-a4e2-6b7f21aeae96'::uuid THEN
    BEGIN
      PERFORM public.enqueue_meta_capi_event(
        p_lead_id => NEW.id,
        p_event_name => 'Lead',
        p_event_time => now(),
        p_custom_data => '{}'::jsonb,
        p_lead_event_source => 'Qualificado'
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.ops_events (fn, level, category, message, ctx, error_detail)
      VALUES ('trg_pipeline_lead_capi', 'warn', 'capi',
              'capi_enqueue_failed_ignored',
              jsonb_build_object('lead_id', NEW.id, 'event', 'Lead/Qualificado'),
              SQLSTATE || ': ' || SQLERRM);
    END;
  END IF;
  RETURN NEW;
END;
$$;

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
      BEGIN
        PERFORM public.enqueue_meta_capi_event(
          p_lead_id => NEW.pipeline_lead_id,
          p_event_name => v_event,
          p_event_time => now(),
          p_custom_data => v_custom
        );
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.ops_events (fn, level, category, message, ctx, error_detail)
        VALUES ('trg_visita_capi', 'warn', 'capi',
                'capi_enqueue_failed_ignored',
                jsonb_build_object('lead_id', NEW.pipeline_lead_id, 'visita_id', NEW.id, 'event', v_event),
                SQLSTATE || ': ' || SQLERRM);
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

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
    BEGIN
      PERFORM public.enqueue_meta_capi_event(
        p_lead_id => NEW.pipeline_lead_id,
        p_event_name => 'Purchase',
        p_event_time => now(),
        p_custom_data => v_custom
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.ops_events (fn, level, category, message, ctx, error_detail)
      VALUES ('trg_negocio_capi', 'warn', 'capi',
              'capi_enqueue_failed_ignored',
              jsonb_build_object('lead_id', NEW.pipeline_lead_id, 'negocio_id', NEW.id, 'event', 'Purchase'),
              SQLSTATE || ': ' || SQLERRM);
    END;
  END IF;
  RETURN NEW;
END;
$$;