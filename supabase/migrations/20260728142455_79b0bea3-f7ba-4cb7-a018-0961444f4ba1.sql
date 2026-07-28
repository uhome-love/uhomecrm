
-- Claim next batch (atomic, skip locked)
CREATE OR REPLACE FUNCTION public.claim_meta_capi_batch(_limit int DEFAULT 100)
RETURNS TABLE(event_id text, payload jsonb, attempts int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT q.event_id
    FROM public.meta_capi_queue q
    WHERE q.status = 'pending'
      AND (q.sent_at IS NULL)
      AND (q.created_at + (
        CASE q.attempts
          WHEN 0 THEN interval '0'
          WHEN 1 THEN interval '1 minute'
          WHEN 2 THEN interval '5 minutes'
          WHEN 3 THEN interval '15 minutes'
          WHEN 4 THEN interval '1 hour'
          ELSE interval '6 hours'
        END
      )) <= now()
    ORDER BY q.created_at ASC
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.meta_capi_queue q
    SET status = 'processing', attempts = q.attempts + 1
    FROM picked
    WHERE q.event_id = picked.event_id
    RETURNING q.event_id, q.payload, q.attempts
  )
  SELECT u.event_id, u.payload, u.attempts FROM updated u;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_meta_capi_batch(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meta_capi_batch(int) TO service_role;

-- Mark batch as successfully sent
CREATE OR REPLACE FUNCTION public.mark_meta_capi_sent(_event_ids text[], _fbtrace_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.meta_capi_queue
  SET status = 'sent',
      sent_at = now(),
      fbtrace_id = _fbtrace_id,
      last_error = NULL
  WHERE event_id = ANY(_event_ids);
$$;

REVOKE ALL ON FUNCTION public.mark_meta_capi_sent(text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_meta_capi_sent(text[], text) TO service_role;

-- Mark batch as failed (returns to pending, or 'failed' after max attempts)
CREATE OR REPLACE FUNCTION public.mark_meta_capi_failed(_event_ids text[], _error text, _max_attempts int DEFAULT 5)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.meta_capi_queue
  SET status = CASE WHEN attempts >= _max_attempts THEN 'failed' ELSE 'pending' END,
      last_error = _error
  WHERE event_id = ANY(_event_ids);
$$;

REVOKE ALL ON FUNCTION public.mark_meta_capi_failed(text[], text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_meta_capi_failed(text[], text, int) TO service_role;
