ALTER TABLE public.oferta_ativa_ligacoes
DROP CONSTRAINT IF EXISTS oferta_ativa_ligacoes_resultado_check;

ALTER TABLE public.oferta_ativa_ligacoes
ADD CONSTRAINT oferta_ativa_ligacoes_resultado_check
CHECK (resultado = ANY (ARRAY['aproveitado','nao_atendeu','sem_interesse','visita_agendada','pulado']::text[]));