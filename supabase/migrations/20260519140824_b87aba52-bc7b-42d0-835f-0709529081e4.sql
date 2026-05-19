
CREATE OR REPLACE FUNCTION public.reengajamento_resumo_hoje()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT *
    FROM public.reengajamento_meta_disparos
    WHERE created_at >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date) AT TIME ZONE 'America/Sao_Paulo'
  ),
  agg AS (
    SELECT
      COUNT(*)::int                                                              AS total,
      COUNT(*) FILTER (WHERE sent_at IS NOT NULL)::int                            AS sent,
      COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)::int                       AS delivered,
      COUNT(*) FILTER (WHERE read_at IS NOT NULL)::int                            AS read,
      COUNT(*) FILTER (WHERE responded_at IS NOT NULL)::int                       AS responded,
      COUNT(*) FILTER (WHERE status = 'failed')::int                              AS failed
    FROM base
  ),
  sim_nao AS (
    SELECT
      COUNT(DISTINCT lead_id) FILTER (
        WHERE button_response = 'sim'
           OR lower(coalesce(response_text,'')) LIKE 'sim%'
      )::int AS sim,
      COUNT(DISTINCT lead_id) FILTER (
        WHERE button_response = 'nao'
           OR lower(coalesce(response_text,'')) ~ 'n[aã]o'
      )::int AS nao
    FROM base
    WHERE lead_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'total',     agg.total,
    'sent',      agg.sent,
    'delivered', agg.delivered,
    'read',      agg.read,
    'responded', agg.responded,
    'failed',    agg.failed,
    'sim',       sim_nao.sim,
    'nao',       sim_nao.nao
  )
  FROM agg, sim_nao;
$$;

GRANT EXECUTE ON FUNCTION public.reengajamento_resumo_hoje() TO authenticated, anon;
