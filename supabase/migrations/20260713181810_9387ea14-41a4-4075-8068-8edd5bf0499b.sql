CREATE OR REPLACE FUNCTION public.get_reengajamento_fila_bases()
RETURNS TABLE (
  template_name text,
  total bigint,
  telefones bigint,
  ultima timestamptz,
  motivo_predominante text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH fails AS (
    SELECT
      COALESCE(template_name, '(sem template)') AS template_name,
      phone,
      error_text,
      created_at
    FROM public.reengajamento_meta_disparos
    WHERE status = 'failed' AND run_id IS NOT NULL
  ),
  motivos AS (
    SELECT
      template_name,
      COALESCE(error_text, 'Motivo não informado') AS motivo,
      count(*) AS n,
      row_number() OVER (PARTITION BY template_name ORDER BY count(*) DESC) AS rn
    FROM fails
    GROUP BY template_name, COALESCE(error_text, 'Motivo não informado')
  )
  SELECT
    f.template_name,
    count(*)::bigint AS total,
    count(DISTINCT f.phone)::bigint AS telefones,
    max(f.created_at) AS ultima,
    (SELECT m.motivo FROM motivos m WHERE m.template_name = f.template_name AND m.rn = 1) AS motivo_predominante
  FROM fails f
  GROUP BY f.template_name
  ORDER BY total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_reengajamento_fila_bases() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reengajamento_fila_bases() TO service_role;