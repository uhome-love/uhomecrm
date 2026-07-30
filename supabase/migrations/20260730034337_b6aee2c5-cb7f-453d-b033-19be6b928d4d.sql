ALTER TABLE public.distribuicao_historico ALTER COLUMN corretor_id DROP NOT NULL;

ALTER TABLE public.distribuicao_historico
  ADD CONSTRAINT distribuicao_historico_corretor_obrigatorio
  CHECK (corretor_id IS NOT NULL OR acao = 'fila_ceo');