-- Retention cleanup function for ops_events
-- Policy: 30 days for info/warn, 90 days for errors

CREATE OR REPLACE FUNCTION public.cleanup_ops_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ops_events
  WHERE (level IN ('info', 'warn') AND created_at < now() - interval '30 days')
     OR (level = 'error' AND created_at < now() - interval '90 days');
$$;

COMMENT ON FUNCTION public.cleanup_ops_events() IS
  'Retention policy for ops_events: 30d info/warn, 90d errors. Runs daily via pg_cron.';