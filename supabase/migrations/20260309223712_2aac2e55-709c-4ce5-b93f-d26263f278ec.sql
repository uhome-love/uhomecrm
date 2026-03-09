
-- One-time cleanup: deactivate afternoon fila entries since we're now in noturna
UPDATE roleta_fila
SET ativo = false
WHERE data = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND ativo = true
  AND janela = 'tarde';
