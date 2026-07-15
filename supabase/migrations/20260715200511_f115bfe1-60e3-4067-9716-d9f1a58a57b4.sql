UPDATE public.reengajamento_config
SET paused = false,
    paused_reason = NULL,
    paused_at_brt = NULL,
    paused_until_release = false,
    updated_at = now()
WHERE canal = 'meta';