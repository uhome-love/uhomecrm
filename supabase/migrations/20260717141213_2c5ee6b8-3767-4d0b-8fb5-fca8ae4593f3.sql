ALTER TABLE public.reengajamento_dispatch_queue
  ADD COLUMN IF NOT EXISTS locked_by uuid;

ALTER TABLE public.reengajamento_config
  ADD COLUMN IF NOT EXISTS throttle_level integer NOT NULL DEFAULT 0
    CHECK (throttle_level BETWEEN 0 AND 2),
  ADD COLUMN IF NOT EXISTS throttle_updated_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_reengajamento_dispatch_queue_claim
  ON public.reengajamento_dispatch_queue (run_id, status, locked_at, created_at);

CREATE OR REPLACE FUNCTION public.claim_reengajamento_dispatch_queue(
  p_run_id uuid,
  p_batch_size integer,
  p_worker_id uuid
)
RETURNS SETOF public.reengajamento_dispatch_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_run_id IS NULL OR p_worker_id IS NULL THEN
    RAISE EXCEPTION 'run_id and worker_id are required';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT q.id
    FROM public.reengajamento_dispatch_queue q
    WHERE q.run_id = p_run_id
      AND (
        q.status = 'pending'
        OR (q.status = 'processing' AND q.locked_at < now() - interval '6 minutes')
      )
    ORDER BY q.created_at, q.id
    LIMIT LEAST(GREATEST(COALESCE(p_batch_size, 1), 1), 30)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.reengajamento_dispatch_queue q
    SET status = 'processing',
        locked_at = now(),
        locked_by = p_worker_id,
        attempts = q.attempts + 1,
        error_text = NULL
    FROM candidates c
    WHERE q.id = c.id
    RETURNING q.*
  )
  SELECT * FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_reengajamento_dispatch_queue(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reengajamento_dispatch_queue(uuid, integer, uuid) TO service_role;