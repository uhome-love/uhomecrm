-- Passagem de bastão da LIA: marca quando a LIA já AVISOU o lead de que um
-- especialista humano vai seguir o atendimento. Serve de trava pra nunca
-- anunciar o repasse duas vezes. Aditivo e idempotente.
alter table public.lia_estado
  add column if not exists repassado_em timestamptz;
