
-- Fix stale checkpoint data for Bruno's team on 2026-03-05
-- Sync real_ligacoes and real_leads from oferta_ativa_tentativas

WITH today_stats AS (
  SELECT 
    tm.id as team_member_id,
    COUNT(t.id) as total_tentativas,
    COUNT(t.id) FILTER (WHERE t.resultado = 'com_interesse') as total_aproveitados
  FROM team_members tm
  LEFT JOIN oferta_ativa_tentativas t ON t.corretor_id = tm.user_id 
    AND t.created_at >= '2026-03-05T00:00:00-03:00'::timestamptz
    AND t.created_at <= '2026-03-05T23:59:59.999-03:00'::timestamptz
  WHERE tm.gerente_id = 'fb61ecda-5c4b-49d7-bda7-ccf9b589da07'
    AND tm.status = 'ativo'
  GROUP BY tm.id
)
UPDATE checkpoint_lines cl
SET 
  real_ligacoes = ts.total_tentativas,
  real_leads = ts.total_aproveitados,
  updated_at = now()
FROM today_stats ts
WHERE cl.checkpoint_id = '0b5d698a-c2a3-4b6b-a41e-dbe16a371542'
  AND cl.corretor_id = ts.team_member_id
