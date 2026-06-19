update public.reengajamento_dispatch_runs
set status = 'timeout',
    finished_at = now(),
    motivo_parada = 'Encerrado manualmente: função morta pelo limite de tempo antes de encadear o próximo lote'
where id = 'e8189f0b-31ad-4cc6-b821-22d3f82e5118'
  and status = 'running';