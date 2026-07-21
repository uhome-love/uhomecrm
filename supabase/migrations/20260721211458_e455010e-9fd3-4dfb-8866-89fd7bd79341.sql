DELETE FROM public.roleta_credenciamentos
WHERE janela = 'noturna'
  AND data = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND status IN ('pendente','aprovado')
  AND (segmento_1_id IS NOT NULL OR segmento_2_id IS NOT NULL);