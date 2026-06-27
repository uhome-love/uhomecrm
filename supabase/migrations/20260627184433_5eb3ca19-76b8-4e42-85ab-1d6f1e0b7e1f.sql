UPDATE public.reengajamento_config
SET paused = false,
    paused_until_release = false,
    paused_reason = '',
    guard_reset_at = now(),
    updated_at = now();

-- encerra runs antigos presos em 'paused' que não têm fila pendente (limpeza de estado)
UPDATE public.reengajamento_dispatch_runs r
SET status = 'timeout',
    finished_at = COALESCE(r.finished_at, now()),
    motivo_parada = COALESCE(NULLIF(r.motivo_parada,''),'') || ' [encerrado na limpeza: sem fila pendente]'
WHERE r.status = 'paused'
  AND NOT EXISTS (
    SELECT 1 FROM public.reengajamento_dispatch_queue q
    WHERE q.run_id = r.id AND q.status IN ('pending','processing')
  );