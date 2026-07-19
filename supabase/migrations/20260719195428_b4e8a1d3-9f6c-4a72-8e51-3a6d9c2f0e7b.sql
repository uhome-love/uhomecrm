-- Mailgun foi cancelado (19/07/2026) — desagenda o cron job que chama a
-- edge function 'mailgun-batch-cron' (rodava a cada minuto, ~43k
-- vezes/mês). A função em si já foi removida do código nesta mesma
-- rodada de auditoria; sem isso, o cron continuaria batendo num endpoint
-- inexistente, como já aconteceu com o visita-amanha-enqueue.
DO $$
DECLARE
  target_job_id integer;
BEGIN
  SELECT jobid
  INTO target_job_id
  FROM cron.job
  WHERE command ILIKE '%mailgun-batch-cron%'
  ORDER BY jobid DESC
  LIMIT 1;

  IF target_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(target_job_id);
  END IF;
END $$;
