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

  IF target_job_id IS NULL THEN
    RAISE EXCEPTION 'mailgun-batch-cron cron job not found';
  END IF;

  PERFORM cron.alter_job(job_id := target_job_id, schedule := '* * * * *');
END $$;