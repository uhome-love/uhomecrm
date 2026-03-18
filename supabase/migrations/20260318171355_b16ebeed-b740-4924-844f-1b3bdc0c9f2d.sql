UPDATE oferta_ativa_leads
SET status = 'na_fila', motivo_descarte = NULL, updated_at = now()
WHERE lista_id = 'cc228a85-a805-458c-81e1-cc081d96ea26'
  AND status = 'descartado';