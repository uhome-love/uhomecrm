UPDATE public.pipeline_leads
SET aceite_status = 'descartado'
WHERE arquivado = true
  AND aceite_status = 'pendente_distribuicao'
  AND motivo_descarte = 'oferta_ativa_atrio_lote2';