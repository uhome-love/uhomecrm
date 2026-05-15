
ALTER TABLE public.visita_amanha_config
  ADD COLUMN IF NOT EXISTS running_until timestamptz;

-- Reschedule cron to every 2 minutes
DO $$
BEGIN
  PERFORM cron.unschedule('visita-amanha-auto-1min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('visita-amanha-auto-2min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'visita-amanha-auto-2min',
  '*/2 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://hunbxqzhvuemgntklyzb.supabase.co/functions/v1/visita-amanha-enqueue',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"force":true}'::jsonb
    )
  $cron$
);
