
-- Cron health tracking
CREATE TABLE IF NOT EXISTS public.cron_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error')),
  error_message TEXT,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_health_name_started ON public.cron_health (cron_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_health_status ON public.cron_health (status, started_at DESC);

ALTER TABLE public.cron_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view cron_health" ON public.cron_health;
CREATE POLICY "Admins view cron_health" ON public.cron_health
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- Helper to log cron runs
CREATE OR REPLACE FUNCTION public.log_cron_run(
  p_cron_name TEXT,
  p_status TEXT DEFAULT 'success',
  p_error TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_started_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_started TIMESTAMPTZ := COALESCE(p_started_at, now());
BEGIN
  INSERT INTO public.cron_health (cron_name, started_at, finished_at, status, error_message, duration_ms, metadata)
  VALUES (
    p_cron_name,
    v_started,
    now(),
    p_status,
    p_error,
    EXTRACT(MILLISECOND FROM (now() - v_started))::INTEGER,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  -- Retain only last 7 days
  DELETE FROM public.cron_health WHERE started_at < now() - INTERVAL '7 days';

  RETURN v_id;
END;
$$;

-- View of consecutive failures per cron
CREATE OR REPLACE VIEW public.v_cron_health_summary AS
WITH ranked AS (
  SELECT cron_name, status, started_at,
    ROW_NUMBER() OVER (PARTITION BY cron_name ORDER BY started_at DESC) AS rn
  FROM public.cron_health
)
SELECT
  cron_name,
  COUNT(*) FILTER (WHERE status = 'error' AND rn <= 5) AS recent_errors,
  MAX(started_at) AS last_run,
  (SELECT status FROM ranked r2 WHERE r2.cron_name = ranked.cron_name AND r2.rn = 1) AS last_status
FROM ranked
GROUP BY cron_name;
