-- Cancelamento de entrevista (auditoria). Aditivo, sem constraint/enum.
-- Status 'cancelada' é texto livre (a coluna status não tem CHECK). Ao cancelar,
-- registramos quem cancelou, o motivo e quando; o candidato volta para 'atendimento'.
-- O índice único parcial rh_entrevistas_slot_agendada_uidx (WHERE status='agendada')
-- libera o horário automaticamente quando a entrevista sai de 'agendada'.
-- Já aplicada em produção em 13/08/2026; este arquivo mantém o repo como fonte.

ALTER TABLE public.rh_entrevistas
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS cancelada_por uuid,
  ADD COLUMN IF NOT EXISTS cancelada_em timestamptz;
