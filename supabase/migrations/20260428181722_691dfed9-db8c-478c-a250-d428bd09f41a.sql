UPDATE public.pipeline_leads
SET arquivado = true,
    updated_at = now(),
    ultima_acao_at = now()
WHERE tipo_descarte = 'definitivo'
  AND motivo_descarte ILIKE 'Inativado:%'
  AND arquivado = false;