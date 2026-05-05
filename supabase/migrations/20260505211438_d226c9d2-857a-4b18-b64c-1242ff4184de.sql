-- Ajustar cron do shift-cleanup tarde para fechar 18:00 BRT (21:00 UTC) em vez de 18:30 BRT
SELECT cron.unschedule('roleta-shift-cleanup-tarde');
SELECT cron.schedule(
  'roleta-shift-cleanup-tarde',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url:='https://hunbxqzhvuemgntklyzb.supabase.co/functions/v1/roleta-shift-cleanup',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1bmJ4cXpodnVlbWdudGtseXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1ODI2NTUsImV4cCI6MjA4ODE1ODY1NX0.giwij9kxlColZF21iBHZO8in86kGNJIHWXHqtdik6oY"}'::jsonb,
    body:='{"trigger": "cron_tarde"}'::jsonb
  ) AS request_id;
  $$
);