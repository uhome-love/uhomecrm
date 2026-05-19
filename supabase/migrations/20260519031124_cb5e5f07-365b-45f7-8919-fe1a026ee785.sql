-- ── MATERIALIZED VIEW (agregação diária BRT)
CREATE MATERIALIZED VIEW public.page_views_daily AS
SELECT
  (date_trunc('day', viewed_at AT TIME ZONE 'America/Sao_Paulo'))::date AS dia_brt,
  route_pattern,
  role,
  count(*)::bigint AS visits,
  count(DISTINCT user_id)::bigint AS unique_users,
  count(DISTINCT session_id)::bigint AS sessions,
  (percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms))::int AS median_duration_ms
FROM public.page_views
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX page_views_daily_pk
  ON public.page_views_daily (dia_brt, route_pattern, role);

REVOKE ALL ON public.page_views_daily FROM PUBLIC;

-- ── flush_page_views (sendBeacon / fetch keepalive batch)
CREATE OR REPLACE FUNCTION public.flush_page_views(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_updates jsonb := COALESCE(payload->'updates', '[]'::jsonb);
  v_inserts jsonb := COALESCE(payload->'inserts', '[]'::jsonb);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  UPDATE public.page_views pv
     SET duration_ms = (u->>'duration_ms')::int
    FROM jsonb_array_elements(v_updates) u
   WHERE pv.id = (u->>'id')::uuid
     AND pv.user_id = v_uid;

  INSERT INTO public.page_views
    (user_id, role, route, route_pattern, referrer_route,
     session_id, duration_ms, viewport_width, viewed_at)
  SELECT v_uid,
         i->>'role',
         i->>'route',
         i->>'route_pattern',
         NULLIF(i->>'referrer_route',''),
         i->>'session_id',
         NULLIF(i->>'duration_ms','')::int,
         NULLIF(i->>'viewport_width','')::int,
         COALESCE(NULLIF(i->>'viewed_at','')::timestamptz, now())
    FROM jsonb_array_elements(v_inserts) i;
END $$;

REVOKE ALL ON FUNCTION public.flush_page_views(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flush_page_views(jsonb) TO authenticated;

-- ── get_page_views_stats (KPIs)
CREATE OR REPLACE FUNCTION public.get_page_views_stats(
  p_since timestamptz,
  p_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_sessions bigint;
  v_users bigint;
  v_unknown bigint;
  v_top jsonb;
  v_role_dist jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*), count(DISTINCT session_id), count(DISTINCT user_id),
         count(*) FILTER (WHERE route_pattern = '/_unknown')
    INTO v_total, v_sessions, v_users, v_unknown
    FROM public.page_views
   WHERE viewed_at >= p_since
     AND (p_role IS NULL OR role = p_role);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'route_pattern', route_pattern,
           'visits', visits
         ) ORDER BY visits DESC), '[]'::jsonb)
    INTO v_top
    FROM (
      SELECT route_pattern, count(*)::bigint AS visits
        FROM public.page_views
       WHERE viewed_at >= p_since
         AND (p_role IS NULL OR role = p_role)
       GROUP BY 1
       ORDER BY 2 DESC
       LIMIT 5
    ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'role', role,
           'visits', visits
         )), '[]'::jsonb)
    INTO v_role_dist
    FROM (
      SELECT role, count(*)::bigint AS visits
        FROM public.page_views
       WHERE viewed_at >= p_since
       GROUP BY 1
    ) r;

  RETURN jsonb_build_object(
    'total_visits', v_total,
    'sessions', v_sessions,
    'unique_users', v_users,
    'unknown_visits', v_unknown,
    'unknown_pct', CASE WHEN v_total > 0 THEN round((v_unknown::numeric / v_total) * 100, 2) ELSE 0 END,
    'top_routes', v_top,
    'role_distribution', v_role_dist
  );
END $$;

REVOKE ALL ON FUNCTION public.get_page_views_stats(timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_page_views_stats(timestamptz, text) TO authenticated;

-- ── get_page_views_table (tabela principal)
CREATE OR REPLACE FUNCTION public.get_page_views_table(
  p_since timestamptz,
  p_role text DEFAULT NULL
)
RETURNS TABLE (
  route_pattern text,
  visits bigint,
  unique_users bigint,
  median_duration_ms integer,
  last_viewed timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT pv.route_pattern,
         count(*)::bigint                                                       AS visits,
         count(DISTINCT pv.user_id)::bigint                                     AS unique_users,
         (percentile_cont(0.5) WITHIN GROUP (ORDER BY pv.duration_ms))::int     AS median_duration_ms,
         max(pv.viewed_at)                                                      AS last_viewed
    FROM public.page_views pv
   WHERE pv.viewed_at >= p_since
     AND (p_role IS NULL OR pv.role = p_role)
   GROUP BY pv.route_pattern
   ORDER BY visits DESC
   LIMIT 500;
END $$;

REVOKE ALL ON FUNCTION public.get_page_views_table(timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_page_views_table(timestamptz, text) TO authenticated;