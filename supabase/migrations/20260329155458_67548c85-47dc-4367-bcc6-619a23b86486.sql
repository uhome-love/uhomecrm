-- Insert existing approved credenciamentos into roleta_fila
INSERT INTO roleta_fila (credenciamento_id, corretor_id, segmento_id, data, janela, posicao, ativo)
SELECT 
  rc.id, rc.corretor_id, rc.segmento_1_id, rc.data, rc.janela,
  ROW_NUMBER() OVER (ORDER BY rc.created_at),
  true
FROM roleta_credenciamentos rc
WHERE rc.data = CURRENT_DATE 
  AND rc.status = 'aprovado' 
  AND rc.segmento_1_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM roleta_fila rf 
    WHERE rf.credenciamento_id = rc.id AND rf.segmento_id = rc.segmento_1_id
  )
ON CONFLICT DO NOTHING;

-- Also insert for segmento_2
INSERT INTO roleta_fila (credenciamento_id, corretor_id, segmento_id, data, janela, posicao, ativo)
SELECT 
  rc.id, rc.corretor_id, rc.segmento_2_id, rc.data, rc.janela,
  100 + ROW_NUMBER() OVER (ORDER BY rc.created_at),
  true
FROM roleta_credenciamentos rc
WHERE rc.data = CURRENT_DATE 
  AND rc.status = 'aprovado' 
  AND rc.segmento_2_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM roleta_fila rf 
    WHERE rf.credenciamento_id = rc.id AND rf.segmento_id = rc.segmento_2_id
  )
ON CONFLICT DO NOTHING;

-- Update corretor_disponibilidade for all approved corretores
UPDATE corretor_disponibilidade cd
SET na_roleta = true, updated_at = NOW()
FROM roleta_credenciamentos rc
WHERE rc.auth_user_id = cd.user_id
  AND rc.data = CURRENT_DATE
  AND rc.status = 'aprovado';
