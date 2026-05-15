SELECT cron.schedule(
  'visita-amanha-auto-2min',
  '*/2 * * * *',
  $$ SELECT net.http_post(
       url := 'https://hunbxqzhvuemgntklyzb.supabase.co/functions/v1/visita-amanha-enqueue',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);