CREATE OR REPLACE FUNCTION public.lead_saude_status(p_ultimo_toque timestamptz, p_ref timestamptz, p_stage_tipo text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH cfg AS (
    SELECT CASE p_stage_tipo
      WHEN 'novo_lead' THEN 1 WHEN 'sem_contato' THEN 2
      WHEN 'qualificacao' THEN 7 WHEN 'aquecimento' THEN 15
      WHEN 'visita' THEN 2 WHEN 'proposta' THEN 7 WHEN 'contrato_gerado' THEN 7
      ELSE 7 END AS prazo,
      CASE p_stage_tipo
      WHEN 'sem_contato' THEN 15 WHEN 'qualificacao' THEN 21 WHEN 'aquecimento' THEN 21
      ELSE NULL END AS estagna),
  d AS (
    SELECT EXTRACT(EPOCH FROM ((now() AT TIME ZONE 'America/Sao_Paulo')
             - (COALESCE(p_ultimo_toque, p_ref) AT TIME ZONE 'America/Sao_Paulo')))/86400.0 AS dias, prazo, estagna FROM cfg)
  SELECT CASE
    WHEN p_stage_tipo IN ('venda','caiu','descarte','convertido') THEN 'terminal'
    WHEN estagna IS NOT NULL AND dias > estagna THEN 'estagnado'
    WHEN dias <= prazo THEN 'verde'
    WHEN dias <= prazo*2 THEN 'ambar'
    ELSE 'vermelho' END FROM d;
$$;