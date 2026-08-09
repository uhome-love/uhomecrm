DO $$
BEGIN
  PERFORM net.http_post(
    url := 'https://hunbxqzhvuemgntklyzb.supabase.co/functions/v1/meta-audience-sync',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name IN ('CAPI_CRON_SECRET','capi_cron_secret') ORDER BY name LIMIT 1)
    ),
    body := jsonb_build_object('segmento_chave','invest_qualificados','dry_run',false)
  );
END $$;