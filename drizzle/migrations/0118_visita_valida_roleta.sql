ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS valida_roleta boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS motivo_invalida_roleta text,
  ADD COLUMN IF NOT EXISTS invalidada_roleta_por uuid,
  ADD COLUMN IF NOT EXISTS invalidada_roleta_em timestamptz;

CREATE OR REPLACE FUNCTION public.roleta_visitas_realizadas_periodo(p_auth_user_id uuid, p_inicio date, p_fim date)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH v AS (
    SELECT COALESCE(v.pipeline_lead_id::text, v.id::text) AS cli, v.pipeline_lead_id, v.data_visita,
           COALESCE((SELECT p.user_id FROM public.profiles p WHERE p.id = v.corretor_id), v.corretor_id) AS dono
    FROM public.visitas v
    WHERE v.status = 'realizada' AND v.valida_roleta AND v.data_visita::date BETWEEN p_inicio AND p_fim
  ), vp AS (
    SELECT v.cli, v.dono, pp.pri, pp.parc
    FROM v
    LEFT JOIN LATERAL (
      SELECT x.pri, x.parc FROM (
        SELECT COALESCE(a.user_id, z.corretor_principal_id) AS pri,
               COALESCE(b.user_id, z.corretor_parceiro_id) AS parc, z.created_at
        FROM public.pipeline_parcerias z
        LEFT JOIN public.profiles a ON a.id = z.corretor_principal_id
        LEFT JOIN public.profiles b ON b.id = z.corretor_parceiro_id
        WHERE z.pipeline_lead_id = v.pipeline_lead_id
          AND (z.status = 'ativa' OR (z.status = 'encerrada' AND z.encerrada_em IS NOT NULL AND z.encerrada_em::date > v.data_visita::date))
      ) x
      WHERE x.pri <> x.parc AND v.dono IN (x.pri, x.parc)
      ORDER BY abs(extract(epoch FROM (x.created_at - v.data_visita::timestamp))) LIMIT 1
    ) pp ON true
  ), w AS (
    SELECT cli, CASE WHEN pri IS NULL THEN 1.0 ELSE 0.5 END AS peso
    FROM vp
    WHERE (pri IS NULL AND dono = p_auth_user_id) OR (pri IS NOT NULL AND p_auth_user_id IN (pri, parc))
  )
  SELECT COALESCE(sum(peso), 0)::numeric FROM (SELECT cli, max(peso) AS peso FROM w GROUP BY cli) t;
$function$;