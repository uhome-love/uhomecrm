
-- Taynah dia_todo
INSERT INTO roleta_fila (corretor_id, segmento_id, janela, posicao, data, ativo, credenciamento_id)
SELECT 'c4fc833f-9e6f-447b-9686-241870b4a64e'::uuid, s.seg_id::uuid, 'dia_todo',
  COALESCE((SELECT max(posicao) FROM roleta_fila WHERE data='2026-04-03' AND segmento_id=s.seg_id::uuid AND ativo=true),0)+1,
  '2026-04-03', true, 'f47457d0-37c3-4477-baf4-ffc82506d62b'::uuid
FROM (VALUES ('9948f523-29f4-46a7-bc1b-81ff8bb8dd50'),('d364f084-a63b-4be3-892e-15d66e367b43')) s(seg_id)
WHERE NOT EXISTS (
  SELECT 1 FROM roleta_fila rf WHERE rf.credenciamento_id='f47457d0-37c3-4477-baf4-ffc82506d62b'::uuid AND rf.segmento_id=s.seg_id::uuid AND rf.ativo=true
);

-- Samuel tarde
INSERT INTO roleta_fila (corretor_id, segmento_id, janela, posicao, data, ativo, credenciamento_id)
SELECT 'c7e64e1f-ad3c-4b76-adb3-85b003c3d24e'::uuid, s.seg_id::uuid, 'tarde',
  COALESCE((SELECT max(posicao) FROM roleta_fila WHERE data='2026-04-03' AND segmento_id=s.seg_id::uuid AND ativo=true),0)+1,
  '2026-04-03', true, '901b79c1-7ecd-4467-8176-2e6382779eda'::uuid
FROM (VALUES ('93ca556c-9a32-4fb8-b1af-148100ea47f0'),('d364f084-a63b-4be3-892e-15d66e367b43')) s(seg_id)
WHERE NOT EXISTS (
  SELECT 1 FROM roleta_fila rf WHERE rf.credenciamento_id='901b79c1-7ecd-4467-8176-2e6382779eda'::uuid AND rf.segmento_id=s.seg_id::uuid AND rf.ativo=true
);

-- Rafaela tarde
INSERT INTO roleta_fila (corretor_id, segmento_id, janela, posicao, data, ativo, credenciamento_id)
SELECT '015f5dbf-e90e-4221-afdd-f460165735c2'::uuid, s.seg_id::uuid, 'tarde',
  COALESCE((SELECT max(posicao) FROM roleta_fila WHERE data='2026-04-03' AND segmento_id=s.seg_id::uuid AND ativo=true),0)+1,
  '2026-04-03', true, '149685da-999f-4f97-a21d-f836884b7220'::uuid
FROM (VALUES ('93ca556c-9a32-4fb8-b1af-148100ea47f0'),('409aeddf-077f-473a-97cc-dfc0692ed35e')) s(seg_id)
WHERE NOT EXISTS (
  SELECT 1 FROM roleta_fila rf WHERE rf.credenciamento_id='149685da-999f-4f97-a21d-f836884b7220'::uuid AND rf.segmento_id=s.seg_id::uuid AND rf.ativo=true
);
