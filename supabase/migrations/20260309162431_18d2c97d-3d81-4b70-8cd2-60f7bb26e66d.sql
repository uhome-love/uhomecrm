
-- Remove duplicate fila entries (keep lowest posicao per corretor+segmento+data)
DELETE FROM roleta_fila
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY corretor_id, segmento_id, data ORDER BY posicao ASC) as rn
    FROM roleta_fila
    WHERE data = '2026-03-09' AND ativo = true
  ) sub
  WHERE rn > 1
);
