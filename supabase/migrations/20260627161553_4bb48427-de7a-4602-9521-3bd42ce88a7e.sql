CREATE OR REPLACE FUNCTION public.reengajamento_resumo_hoje()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH bounds AS (
    SELECT timezone('America/Sao_Paulo',
             date_trunc('day', timezone('America/Sao_Paulo', now()))
           ) AS dia_inicio
  ),
  envio AS (
    SELECT
      COUNT(*)::int                                          AS total,
      COUNT(*) FILTER (WHERE sent_at IS NOT NULL)::int       AS sent,
      COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)::int  AS delivered,
      COUNT(*) FILTER (WHERE read_at IS NOT NULL)::int       AS read,
      COUNT(*) FILTER (WHERE status = 'failed')::int         AS failed
    FROM public.reengajamento_meta_disparos, bounds
    WHERE created_at >= bounds.dia_inicio
  ),
  resposta AS (
    SELECT
      COUNT(*) FILTER (WHERE responded_at IS NOT NULL)::int  AS responded,
      COUNT(DISTINCT lead_id) FILTER (
        WHERE button_response = 'sim'
           OR lower(coalesce(response_text,'')) LIKE 'sim%'
      )::int AS sim,
      COUNT(DISTINCT lead_id) FILTER (
        WHERE button_response = 'nao'
           OR lower(coalesce(response_text,'')) ~ 'n[aã]o'
      )::int AS nao
    FROM public.reengajamento_meta_disparos, bounds
    WHERE responded_at >= bounds.dia_inicio
  )
  SELECT jsonb_build_object(
    'total',     envio.total,
    'sent',      envio.sent,
    'delivered', envio.delivered,
    'read',      envio.read,
    'responded', resposta.responded,
    'failed',    envio.failed,
    'sim',       resposta.sim,
    'nao',       resposta.nao
  )
  FROM envio, resposta;
$function$;