-- Fluxo ÚNICO do pipeline de leads (fusão lead + negócio)

-- 1) Remaneja leads das etapas fundidas
UPDATE public.pipeline_leads
SET stage_id = '1ea43190-44c8-43ec-91b4-409b055b0e58', stage_changed_at = now()
WHERE stage_id IN ('8e2a3285-70f9-438d-be2d-13b0bf4610c4','88be333e-964a-4cfd-8e17-6eb5ea64a286');

UPDATE public.pipeline_leads
SET stage_id = 'b0a94ce6-b295-45b8-a023-b23e140d0ba4', stage_changed_at = now()
WHERE stage_id = '2096921e-f8c9-4212-91c8-dae055bc5710';

UPDATE public.pipeline_leads
SET stage_id = 'a857139f-c419-4e37-ae17-5f5e70b21172', stage_changed_at = now(),
    flag_status = COALESCE(flag_status,'{}'::jsonb) || '{"status_visita":"pos_visita"}'::jsonb
WHERE stage_id = 'd932fb49-419c-4fda-bae1-9ef06ee2d033';

UPDATE public.pipeline_leads
SET stage_id = 'a857139f-c419-4e37-ae17-5f5e70b21172', stage_changed_at = now(),
    flag_status = COALESCE(flag_status,'{}'::jsonb) || '{"status_visita":"realizada"}'::jsonb
WHERE stage_id = '5ad4f4aa-b66f-4dc2-ac90-97c55e846a14';

UPDATE public.pipeline_leads
SET stage_id = 'de6cee2f-8dda-4e60-a4e2-6b7f21aeae96', stage_changed_at = now()
WHERE stage_id = 'a8a1a867-5b0c-414e-9532-8873c4ca5a0f';

-- 2) Renomeia / reordena etapas canônicas
UPDATE public.pipeline_stages SET nome='Novo Lead', ordem=0, ativo=true WHERE id='d3843b2f-2fa1-4c31-9129-4eb0ed21f019';
UPDATE public.pipeline_stages SET nome='Sem Contato', ordem=1, ativo=true WHERE id='2fcba9be-1188-4a54-9452-394beefdc330';
UPDATE public.pipeline_stages SET nome='Atendimento / Qualificação', tipo='qualificacao', ordem=2, ativo=true WHERE id='1ea43190-44c8-43ec-91b4-409b055b0e58';
UPDATE public.pipeline_stages SET nome='Nutrição / Aquecimento', tipo='aquecimento', ordem=3, ativo=true WHERE id='b0a94ce6-b295-45b8-a023-b23e140d0ba4';
UPDATE public.pipeline_stages SET nome='Visita', tipo='visita', ordem=4, ativo=true WHERE id='a857139f-c419-4e37-ae17-5f5e70b21172';
UPDATE public.pipeline_stages SET nome='Proposta / Negociação', tipo='proposta', ordem=5, ativo=true WHERE id='de6cee2f-8dda-4e60-a4e2-6b7f21aeae96';
UPDATE public.pipeline_stages SET nome='Contrato Gerado', tipo='contrato_gerado', ordem=7, ativo=true WHERE id='8c1eed68-4526-479f-9bb4-b8e70bee1416';
UPDATE public.pipeline_stages SET nome='Ganho', tipo='venda', ordem=8, ativo=true WHERE id='2d7739eb-1787-4ad6-887a-7a4a32dcfc05';

-- 3) Cria a etapa Aprovação / Documentação
INSERT INTO public.pipeline_stages (id, nome, tipo, cor, ordem, pipeline_tipo, ativo)
VALUES (gen_random_uuid(), 'Aprovação / Documentação', 'documentacao', '#f59e0b', 6, 'leads', true);

-- 4) Desativa etapas fundidas (preserva histórico)
UPDATE public.pipeline_stages SET ativo=false
WHERE id IN (
  '8e2a3285-70f9-438d-be2d-13b0bf4610c4',
  '88be333e-964a-4cfd-8e17-6eb5ea64a286',
  '2096921e-f8c9-4212-91c8-dae055bc5710',
  'd932fb49-419c-4fda-bae1-9ef06ee2d033',
  '5ad4f4aa-b66f-4dc2-ac90-97c55e846a14',
  'c9fcf0ad-dcab-4575-b91f-3f76610e4d44',
  'a8a1a867-5b0c-414e-9532-8873c4ca5a0f'
);