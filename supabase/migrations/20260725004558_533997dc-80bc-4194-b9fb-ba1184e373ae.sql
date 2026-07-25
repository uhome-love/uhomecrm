
-- Onda 1: Base da semana flag + view v_oa_lista_potencial

ALTER TABLE public.oferta_ativa_listas
  ADD COLUMN IF NOT EXISTS is_base_semana boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_oa_listas_base_semana
  ON public.oferta_ativa_listas(is_base_semana) WHERE is_base_semana = true;

-- View de potencial por lista: volume disponível + aproveitamento 90d
CREATE OR REPLACE VIEW public.v_oa_lista_potencial AS
WITH stats_90d AS (
  SELECT
    t.lista_id,
    COUNT(*)::int AS tentativas_90d,
    COUNT(*) FILTER (WHERE t.resultado = 'aproveitado')::int AS aproveitados_90d
  FROM public.oferta_ativa_tentativas t
  WHERE t.created_at >= now() - interval '90 days'
    AND t.lista_id IS NOT NULL
  GROUP BY t.lista_id
),
stats_hoje AS (
  SELECT lista_id, COUNT(*)::int AS ligados_hoje
  FROM public.oferta_ativa_tentativas
  WHERE created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  GROUP BY lista_id
),
disponivel AS (
  SELECT lista_id, COUNT(*)::int AS na_fila
  FROM public.oferta_ativa_leads
  WHERE status = 'disponivel'
  GROUP BY lista_id
)
SELECT
  l.id AS lista_id,
  l.nome,
  l.empreendimento,
  l.empreendimento_canonico_id,
  l.segmento_id,
  l.is_base_semana,
  l.total_leads,
  COALESCE(d.na_fila, 0) AS na_fila,
  COALESCE(h.ligados_hoje, 0) AS ligados_hoje,
  COALESCE(s.tentativas_90d, 0) AS tentativas_90d,
  COALESCE(s.aproveitados_90d, 0) AS aproveitados_90d,
  CASE
    WHEN COALESCE(s.tentativas_90d, 0) = 0 THEN 0
    ELSE ROUND((s.aproveitados_90d::numeric / s.tentativas_90d) * 100, 1)
  END AS pct_aproveitamento_90d,
  CASE
    WHEN COALESCE(d.na_fila, 0) >= 100
      AND COALESCE(s.tentativas_90d, 0) >= 20
      AND (COALESCE(s.aproveitados_90d, 0)::numeric / NULLIF(s.tentativas_90d, 0)) >= 0.10
      THEN 'alto'
    WHEN COALESCE(d.na_fila, 0) >= 30
      AND COALESCE(s.tentativas_90d, 0) >= 10
      AND (COALESCE(s.aproveitados_90d, 0)::numeric / NULLIF(s.tentativas_90d, 0)) >= 0.05
      THEN 'bom'
    ELSE 'padrao'
  END AS potencial
FROM public.oferta_ativa_listas l
LEFT JOIN stats_90d s ON s.lista_id = l.id
LEFT JOIN stats_hoje h ON h.lista_id = l.id
LEFT JOIN disponivel d ON d.lista_id = l.id
WHERE l.status = 'ativa';

GRANT SELECT ON public.v_oa_lista_potencial TO authenticated;
GRANT ALL ON public.v_oa_lista_potencial TO service_role;
