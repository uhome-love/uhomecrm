CREATE OR REPLACE FUNCTION public._trg_pipeline_lead_capi()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id
     AND NEW.stage_id = '1ea43190-44c8-43ec-91b4-409b055b0e58'::uuid THEN
    BEGIN
      PERFORM public.enqueue_meta_capi_event(
        p_lead_id => NEW.id,
        p_event_name => 'LeadQualificado',
        p_event_time => now(),
        p_custom_data => '{}'::jsonb,
        p_lead_event_source => 'Qualificado'
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.ops_events (fn, level, category, message, ctx, error_detail)
      VALUES ('trg_pipeline_lead_capi', 'warn', 'capi',
              'capi_enqueue_failed_ignored',
              jsonb_build_object('lead_id', NEW.id, 'event', 'LeadQualificado'),
              SQLSTATE || ': ' || SQLERRM);
    END;
  END IF;
  RETURN NEW;
END;
$function$;