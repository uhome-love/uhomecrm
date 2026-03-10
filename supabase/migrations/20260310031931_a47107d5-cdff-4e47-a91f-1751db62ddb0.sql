
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS unidade text,
  ADD COLUMN IF NOT EXISTS imovel_interesse text,
  ADD COLUMN IF NOT EXISTS proposta_imovel text,
  ADD COLUMN IF NOT EXISTS proposta_valor numeric,
  ADD COLUMN IF NOT EXISTS proposta_situacao text DEFAULT 'aguardando_aceite',
  ADD COLUMN IF NOT EXISTS negociacao_situacao text,
  ADD COLUMN IF NOT EXISTS negociacao_contra_proposta text,
  ADD COLUMN IF NOT EXISTS negociacao_pendencia text,
  ADD COLUMN IF NOT EXISTS documentacao_situacao text DEFAULT 'leitura_contrato';
