
-- Retention policy: prune READ notifications older than 90 days.
-- Rule: lida = true AND created_at < NOW() - INTERVAL '90 days'
-- Safeguards: batch delete (max 1000 per call), only read notifications, returns count.

CREATE OR REPLACE FUNCTION public.prune_old_notifications(batch_size int DEFAULT 1000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.notifications
  WHERE id IN (
    SELECT id FROM public.notifications
    WHERE lida = true
      AND created_at < NOW() - INTERVAL '90 days'
    ORDER BY created_at ASC
    LIMIT batch_size
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Schedule via pg_cron: run daily at 03:00 UTC
-- Deletes up to 1000 old read notifications per run (safe batch).
SELECT cron.schedule(
  'prune-old-notifications',
  '0 3 * * *',
  $$SELECT public.prune_old_notifications(1000)$$
);
