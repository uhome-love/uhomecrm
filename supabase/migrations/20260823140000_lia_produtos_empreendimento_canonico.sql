-- LIA multiproduto: amarra cada imóvel da LIA (lia_produtos) ao seu empreendimento
-- canônico, para o handoff conseguir criar o lead com empreendimento_canonico_id
-- e a roleta (distribuir_lead_atomico) distribuir ao corretor ALOCADO daquele produto,
-- caindo na Fila CEO automaticamente quando não houver alocado ativo.
-- Aditivo e reversível. NÃO altera a roleta nem liga nenhuma captura.

ALTER TABLE public.lia_produtos
  ADD COLUMN IF NOT EXISTS empreendimento_canonico_id uuid
  REFERENCES public.empreendimentos_canonicos(id);

UPDATE public.lia_produtos SET empreendimento_canonico_id = 'fa06971e-f446-42ed-9d39-1527f50d9c05' WHERE slug = 'connect-joao-wallig' AND empreendimento_canonico_id IS NULL;
UPDATE public.lia_produtos SET empreendimento_canonico_id = '4c1b897c-3e1a-4d98-a68b-95e62e1f0a45' WHERE slug = 'casa-tua-porto-alegre' AND empreendimento_canonico_id IS NULL;
UPDATE public.lia_produtos SET empreendimento_canonico_id = 'cda11585-d31f-4a54-97b7-073e2f574e7c' WHERE slug = 'awa-wellness' AND empreendimento_canonico_id IS NULL;
UPDATE public.lia_produtos SET empreendimento_canonico_id = '5f28344e-41e2-4f0c-901d-81455145f6ee' WHERE slug = 'casa-tua-canoas' AND empreendimento_canonico_id IS NULL;
