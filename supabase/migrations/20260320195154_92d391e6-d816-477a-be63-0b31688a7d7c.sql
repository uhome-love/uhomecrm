ALTER TABLE public.email_campaign_recipients
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_claim
ON public.email_campaign_recipients (campaign_id, status, processing_started_at, created_at);

CREATE OR REPLACE FUNCTION public.claim_email_campaign_recipients(
  p_campaign_id UUID,
  p_batch_size INTEGER DEFAULT 80
)
RETURNS TABLE (
  id UUID,
  campaign_id UUID,
  email TEXT,
  nome TEXT,
  lead_id UUID,
  variaveis JSONB,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT e.id
    FROM public.email_campaign_recipients e
    WHERE e.campaign_id = p_campaign_id
      AND (
        COALESCE(e.status, 'pendente') = 'pendente'
        OR (
          e.status = 'processando'
          AND e.processing_started_at < now() - interval '15 minutes'
        )
      )
    ORDER BY COALESCE(e.processing_started_at, e.created_at, now()), e.id
    LIMIT GREATEST(COALESCE(p_batch_size, 80), 1)
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.email_campaign_recipients e
    SET status = 'processando',
        processing_started_at = now(),
        erro = NULL
    FROM candidates c
    WHERE e.id = c.id
    RETURNING e.id, e.campaign_id, e.email, e.nome, e.lead_id, COALESCE(e.variaveis, '{}'::json)::jsonb AS variaveis, e.status
  )
  SELECT updated.id, updated.campaign_id, updated.email, updated.nome, updated.lead_id, updated.variaveis, updated.status
  FROM updated;
END;
$$;

DO $$
DECLARE
  target_job_id INTEGER;
BEGIN
  SELECT jobid
  INTO target_job_id
  FROM cron.job
  WHERE command ILIKE '%mailgun-batch-cron%'
  ORDER BY jobid DESC
  LIMIT 1;

  IF target_job_id IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := target_job_id, schedule := '* * * * *');
  END IF;
END $$;