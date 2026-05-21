UPDATE pipeline_leads
SET reativado_por_nutricao = true,
    reativado_em = COALESCE(reativado_em, '2026-05-21 21:50:28.495231+00')
WHERE id IN (
  '8730bc7f-208b-46cd-bd16-77d14116e994',
  'c6b11602-4ad3-451f-bbfe-76ca36d542e8',
  'a7aed4f1-2072-4216-b95d-6e2107f2d394'
);