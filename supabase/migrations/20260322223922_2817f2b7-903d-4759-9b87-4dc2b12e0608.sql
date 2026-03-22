-- Enable the http extension (required by trigger_sync_status_to_site)
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Make the trigger resilient: wrap http call in exception handler so it never blocks lead moves
CREATE OR REPLACE FUNCTION trigger_sync_status_to_site()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    BEGIN
      PERFORM extensions.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/sync-status-to-site',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
        ),
        body := jsonb_build_object(
          'record', row_to_json(NEW),
          'old_record', row_to_json(OLD)
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sync-status-to-site failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;