
-- Also sync all other gerentes' checkpoint data for today
WITH today_stats AS (
  SELECT 
    tm.id as team_member_id,
    tm.gerente_id,
    COUNT(t.id) as total_tentativas,
    COUNT(t.id) FILTER (WHERE t.resultado = 'com_interesse') as total_aproveitados
  FROM team_members tm
  LEFT JOIN oferta_ativa_tentativas t ON t.corretor_id = tm.user_id 
    AND t.created_at >= '2026-03-05T00:00:00-03:00'::timestamptz
    AND t.created_at <= '2026-03-05T23:59:59.999-03:00'::timestamptz
  WHERE tm.status = 'ativo'
    AND tm.gerente_id != 'fb61ecda-5c4b-49d7-bda7-ccf9b589da07'
  GROUP BY tm.id, tm.gerente_id
),
checkpoint_ids AS (
  SELECT c.id as checkpoint_id, c.gerente_id
  FROM checkpoints c
  WHERE c.data = '2026-03-05'
)
UPDATE checkpoint_lines cl
SET 
  real_ligacoes = ts.total_tentativas,
  real_leads = ts.total_aproveitados,
  updated_at = now()
FROM today_stats ts
JOIN checkpoint_ids ci ON ci.gerente_id = ts.gerente_id
WHERE cl.checkpoint_id = ci.checkpoint_id
  AND cl.corretor_id = ts.team_member_id
