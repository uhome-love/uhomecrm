
CREATE OR REPLACE FUNCTION public.trg_auto_distribute_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_key TEXT;
  v_supabase_url TEXT := 'https://hunbxqzhvuemgntklyzb.supabase.co';
BEGIN
  IF NEW.corretor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_service_key := current_setting('app.settings.service_role_key', true);

  IF v_service_key IS NULL OR v_service_key = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/distribute-lead',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'action', 'distribute_single',
      'pipeline_lead_id', NEW.id::text
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Auto-distribute trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
