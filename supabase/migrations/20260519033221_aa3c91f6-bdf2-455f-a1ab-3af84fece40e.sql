
CREATE OR REPLACE FUNCTION public.edge_health_aggregate(
  p_hours integer DEFAULT 24,
  p_min_calls integer DEFAULT 10
)
RETURNS TABLE (
  fn text,
  total_calls bigint,
  error_calls bigint,
  error_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ops_events.fn,
    count(*) AS total_calls,
    count(*) FILTER (WHERE ops_events.level = 'error') AS error_calls,
    (count(*) FILTER (WHERE ops_events.level = 'error'))::numeric
      / NULLIF(count(*), 0) AS error_rate
  FROM public.ops_events
  WHERE ops_events.created_at > now() - (p_hours || ' hours')::interval
    AND ops_events.fn IS NOT NULL
    AND ops_events.fn <> 'edge-health-alert'
  GROUP BY ops_events.fn
  HAVING count(*) > p_min_calls;
$$;

REVOKE ALL ON FUNCTION public.edge_health_aggregate(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edge_health_aggregate(integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edge_health_aggregate(integer, integer) TO service_role;
