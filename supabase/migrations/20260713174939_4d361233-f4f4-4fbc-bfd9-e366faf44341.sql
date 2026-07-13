-- Parada de emergência do disparo de reengajamento (run 92d33fb8)
UPDATE public.reengajamento_dispatch_runs
SET status = 'cancelled',
    cancel_requested = true,
    finished_at = now(),
    motivo_parada = 'Parada de emergência: conta Meta com pendência de cobrança/elegibilidade (Business eligibility payment issue) e throttle 131049. Envios interrompidos para não queimar a base.'
WHERE id = '92d33fb8-b5f0-4ecb-a023-9380ee72a6df'
  AND status = 'running';

UPDATE public.reengajamento_dispatch_queue
SET status = 'cancelled',
    error_text = COALESCE(error_text, 'Cancelado por parada de emergência (pendência de cobrança Meta)'),
    processed_at = now()
WHERE run_id = '92d33fb8-b5f0-4ecb-a023-9380ee72a6df'
  AND status IN ('pending', 'processing');

UPDATE public.reengajamento_config
SET paused = true,
    paused_reason = 'Parada de emergência 13/07 — conta Meta com pendência de cobrança/elegibilidade. Reativar só após regularizar na Meta.',
    paused_at_brt = (now() AT TIME ZONE 'America/Sao_Paulo')
WHERE enabled = false OR paused = false;