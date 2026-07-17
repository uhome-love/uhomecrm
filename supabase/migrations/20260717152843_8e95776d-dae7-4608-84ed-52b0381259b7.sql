
ALTER TABLE public.pipeline_historico
  ALTER COLUMN stage_novo_id DROP NOT NULL,
  ALTER COLUMN stage_anterior_id DROP NOT NULL;

ALTER TABLE public.pipeline_historico
  DROP CONSTRAINT IF EXISTS pipeline_historico_stage_anterior_id_fkey,
  DROP CONSTRAINT IF EXISTS pipeline_historico_stage_novo_id_fkey;

ALTER TABLE public.pipeline_historico
  ADD CONSTRAINT pipeline_historico_stage_anterior_id_fkey
    FOREIGN KEY (stage_anterior_id) REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  ADD CONSTRAINT pipeline_historico_stage_novo_id_fkey
    FOREIGN KEY (stage_novo_id) REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;

DELETE FROM public.pipeline_stages
WHERE id IN (
  '213e9ca3-0cb3-4893-979d-25f7e2e9cfa1',
  '787d0e74-438e-47e2-b59b-fd6094535b31',
  'd4053a39-21e1-4d4f-b703-6ca6d6ecb65b',
  '598da2c2-f358-4b8a-b4c2-dabc936d5060',
  '6634d176-d596-461b-b854-ad43182f4696',
  '17cd24a4-e531-4caa-a67b-f808da15b158',
  'a8a1a867-5b0c-414e-9532-8873c4ca5a0f',
  '8e2a3285-70f9-438d-be2d-13b0bf4610c4',
  '88be333e-964a-4cfd-8e17-6eb5ea64a286',
  'd932fb49-419c-4fda-bae1-9ef06ee2d033',
  '2096921e-f8c9-4212-91c8-dae055bc5710',
  'c9fcf0ad-dcab-4575-b91f-3f76610e4d44',
  '5ad4f4aa-b66f-4dc2-ac90-97c55e846a14'
);
