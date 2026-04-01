
-- Keep only the first lead (Marcos), requeue the other 6 to fila CEO
UPDATE pipeline_leads
SET corretor_id = NULL,
    aceite_status = 'pendente_distribuicao',
    distribuido_em = NULL,
    aceite_expira_em = NULL,
    updated_at = now()
WHERE id IN (
  'ae27666f-9e73-4570-b23c-7a0a5a06cf12',
  '61c7afff-b12d-493b-85f0-0339d6c99d76',
  '83953c26-41a5-4b9c-99ba-cfcfaf64f80a',
  'ea47ceb3-c41f-4ce0-a8d4-7d2f769ffcaa',
  'aad78a78-81aa-410e-acef-6ca9d6f90d15',
  '5b05e58a-d157-4060-ad4e-76189ffc6100'
);

-- Clean up the distribuicao_historico for these 6 leads so counters are correct
DELETE FROM distribuicao_historico
WHERE pipeline_lead_id IN (
  'ae27666f-9e73-4570-b23c-7a0a5a06cf12',
  '61c7afff-b12d-493b-85f0-0339d6c99d76',
  '83953c26-41a5-4b9c-99ba-cfcfaf64f80a',
  'ea47ceb3-c41f-4ce0-a8d4-7d2f769ffcaa',
  'aad78a78-81aa-410e-acef-6ca9d6f90d15',
  '5b05e58a-d157-4060-ad4e-76189ffc6100'
)
AND acao = 'distribuido';

-- Clean up roleta_distribuicoes for these leads
DELETE FROM roleta_distribuicoes
WHERE lead_id IN (
  'ae27666f-9e73-4570-b23c-7a0a5a06cf12',
  '61c7afff-b12d-493b-85f0-0339d6c99d76',
  '83953c26-41a5-4b9c-99ba-cfcfaf64f80a',
  'ea47ceb3-c41f-4ce0-a8d4-7d2f769ffcaa',
  'aad78a78-81aa-410e-acef-6ca9d6f90d15',
  '5b05e58a-d157-4060-ad4e-76189ffc6100'
);
