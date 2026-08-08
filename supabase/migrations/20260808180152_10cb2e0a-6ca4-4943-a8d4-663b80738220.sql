SELECT cron.unschedule('capi-health-alert-hourly');

SELECT cron.schedule(
  'capi-health-alert-hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hunbxqzhvuemgntklyzb.supabase.co/functions/v1/capi-health-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'capi_cron_secret' LIMIT 1)
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);