-- Add missing empreendimentos to roleta_campanhas
-- Alto Lindóia → Médio-Alto (d364f084)
-- Alfa → Médio-Alto (d364f084)
-- Boa Vista Country Club → Altíssimo (93ca556c)
-- Seen Menino Deus → Altíssimo (93ca556c)
-- Go Carlos Gomes → MCMV (9948f523)
-- Me Day → Médio-Alto (d364f084)

INSERT INTO roleta_campanhas (empreendimento, segmento_id, ativo) VALUES
  ('Alto Lindóia', 'd364f084-a63b-4be3-892e-15d66e367b43', true),
  ('Alfa', 'd364f084-a63b-4be3-892e-15d66e367b43', true),
  ('Boa Vista Country Club', '93ca556c-9a32-4fb8-b1af-148100ea47f0', true),
  ('Seen Menino Deus', '93ca556c-9a32-4fb8-b1af-148100ea47f0', true),
  ('Go Carlos Gomes', '9948f523-29f4-46a7-bc1b-81ff8bb8dd50', true),
  ('Me Day', 'd364f084-a63b-4be3-892e-15d66e367b43', true)
ON CONFLICT DO NOTHING;

-- Fix the remaining 16 leads
WITH seg_map AS (
  SELECT rs.id as roleta_id, ps.id as pipeline_id
  FROM roleta_segmentos rs
  JOIN pipeline_segmentos ps ON LOWER(TRIM(rs.nome)) = LOWER(TRIM(ps.nome))
),
emp_seg AS (
  SELECT rc.empreendimento, sm.pipeline_id as segmento_id
  FROM roleta_campanhas rc
  JOIN seg_map sm ON rc.segmento_id = sm.roleta_id
  WHERE rc.ativo = true
)
UPDATE pipeline_leads pl
SET segmento_id = es.segmento_id
FROM emp_seg es
WHERE pl.segmento_id IS NULL
  AND pl.empreendimento IS NOT NULL
  AND (
    LOWER(TRIM(pl.empreendimento)) = LOWER(TRIM(es.empreendimento))
    OR LOWER(pl.empreendimento) LIKE '%' || LOWER(TRIM(es.empreendimento)) || '%'
  );

-- Fix Melnick Day leads incorrectly mapped to Investimento → should be MCMV
UPDATE pipeline_leads
SET segmento_id = (SELECT id FROM pipeline_segmentos WHERE nome = 'MCMV / Até 500k' LIMIT 1)
WHERE empreendimento LIKE '%Melnick%'
  AND segmento_id = (SELECT id FROM pipeline_segmentos WHERE nome = 'Investimento' LIMIT 1);