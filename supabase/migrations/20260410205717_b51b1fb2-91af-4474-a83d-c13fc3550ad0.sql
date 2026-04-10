
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY corretor_id, segmento_id, data ORDER BY posicao ASC) as rn
  FROM public.roleta_fila
  WHERE ativo = true
    AND data = (now() AT TIME ZONE 'America/Sao_Paulo')::date
)
UPDATE public.roleta_fila
SET ativo = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
