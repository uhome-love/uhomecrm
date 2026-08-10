ALTER TABLE public.rh_candidatos ADD COLUMN IF NOT EXISTS temperatura text NULL;
ALTER TABLE public.rh_candidatos ADD COLUMN IF NOT EXISTS respostas jsonb NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rh_entrevistas_slot_agendada_uidx
  ON public.rh_entrevistas (data_entrevista)
  WHERE status = 'agendada';