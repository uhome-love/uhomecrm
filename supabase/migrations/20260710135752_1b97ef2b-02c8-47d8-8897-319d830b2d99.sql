UPDATE public.system_flags
SET flag_value = true,
    reason = 'Destravado manualmente pelo gestor para disparo — sem cron automático. 10/07/2026.',
    updated_at = now()
WHERE flag_name = 'campaign_dispatch_enabled';