
CREATE OR REPLACE FUNCTION public.reengajamento_pick_next_run()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id
  FROM public.reengajamento_dispatch_runs r
  WHERE r.status = 'running'
    AND EXISTS (
      SELECT 1
      FROM public.reengajamento_dispatch_queue q
      WHERE q.run_id = r.id
        AND (
          q.status = 'pending'
          OR (q.status = 'processing' AND q.locked_at < now() - interval '6 minutes')
        )
    )
  ORDER BY r.started_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.reengajamento_run_bump_enviados(p_run_id uuid)
RETURNS integer
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.reengajamento_dispatch_runs
  SET enviados = COALESCE(enviados, 0) + 1
  WHERE id = p_run_id
  RETURNING enviados;
$$;

CREATE OR REPLACE FUNCTION public.reengajamento_worker_sweep_stale()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH released AS (
    UPDATE public.reengajamento_dispatch_queue
    SET status = 'pending',
        locked_at = NULL,
        locked_by = NULL,
        updated_at = now()
    WHERE status = 'processing'
      AND locked_at < now() - interval '6 minutes'
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO v_count FROM released;
  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.reengajamento_pick_next_run() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reengajamento_run_bump_enviados(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reengajamento_worker_sweep_stale() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reengajamento_pick_next_run() TO service_role;
GRANT EXECUTE ON FUNCTION public.reengajamento_run_bump_enviados(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reengajamento_worker_sweep_stale() TO service_role;
