UPDATE public.reengajamento_config
SET enabled = true,
    paused = false,
    paused_until_release = false,
    paused_reason = 'Destravado manualmente pelo gestor em 10/07/2026 — somente disparo manual; crons automáticos permanecem desligados.',
    updated_at = now()
WHERE paused = true
   OR paused_until_release = true
   OR enabled = false;

UPDATE public.system_flags
SET flag_value = true,
    reason = 'Destravado manualmente pelo gestor para disparo manual — sem cron automático. 10/07/2026.',
    updated_at = now()
WHERE flag_name = 'campaign_dispatch_enabled';

UPDATE public.system_flags
SET flag_value = false,
    reason = COALESCE(reason, 'Cron automático mantido desligado por solicitação do gestor. 10/07/2026.'),
    updated_at = now()
WHERE flag_name = 'campanha_atrio_enabled';