ALTER TABLE public.campanha_atrio_audiencia DROP CONSTRAINT campanha_atrio_audiencia_pkey;
ALTER TABLE public.campanha_atrio_audiencia ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.campanha_atrio_audiencia ADD PRIMARY KEY (id);
ALTER TABLE public.campanha_atrio_audiencia ALTER COLUMN lead_id DROP NOT NULL;
CREATE UNIQUE INDEX campanha_atrio_audiencia_lote_onda_tel_idx
  ON public.campanha_atrio_audiencia (lote, onda, telefone_normalizado);
ALTER TABLE public.campanha_atrio_eventos ALTER COLUMN lead_id DROP NOT NULL;