SELECT cron.unschedule('capi-health-alert-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'capi-health-alert-hourly');

SELECT cron.schedule(
  'capi-health-alert-hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hunbxqzhvuemgntklyzb.supabase.co/functions/v1/capi-health-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);