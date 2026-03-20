
CREATE OR REPLACE FUNCTION public.claim_email_campaign_recipients(
  p_campaign_id uuid,
  p_batch_size int DEFAULT 80
)
RETURNS TABLE(
  id uuid,
  campaign_id uuid,
  email text,
  nome text,
  lead_id uuid,
  variaveis jsonb,
  status text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT ecr.id
    FROM email_campaign_recipients ecr
    WHERE ecr.campaign_id = p_campaign_id
      AND ecr.status = 'pendente'
      AND ecr.processing_started_at IS NULL
    ORDER BY ecr.created_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE email_campaign_recipients ecr
  SET processing_started_at = now(),
      status = 'processando'
  FROM claimed
  WHERE ecr.id = claimed.id
  RETURNING
    ecr.id,
    ecr.campaign_id,
    ecr.email,
    ecr.nome,
    ecr.lead_id,
    COALESCE(ecr.variaveis::jsonb, '{}'::jsonb) AS variaveis,
    ecr.status;
END;
$$;
