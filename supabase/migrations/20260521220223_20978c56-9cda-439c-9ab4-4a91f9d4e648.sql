ALTER TABLE public.campanha_atrio_audiencia ADD COLUMN IF NOT EXISTS lote smallint NOT NULL DEFAULT 1;
ALTER TABLE public.campanha_atrio_controle ADD COLUMN IF NOT EXISTS lote smallint NOT NULL DEFAULT 1;

ALTER TABLE public.campanha_atrio_controle DROP CONSTRAINT IF EXISTS campanha_atrio_controle_onda_check;
ALTER TABLE public.campanha_atrio_controle ADD CONSTRAINT campanha_atrio_controle_onda_check CHECK (onda BETWEEN 1 AND 9);

ALTER TABLE public.campanha_atrio_audiencia DROP CONSTRAINT IF EXISTS campanha_atrio_audiencia_onda_check;
ALTER TABLE public.campanha_atrio_audiencia ADD CONSTRAINT campanha_atrio_audiencia_onda_check CHECK (onda BETWEEN 1 AND 9);

CREATE INDEX IF NOT EXISTS idx_atrio_audiencia_lote_onda ON public.campanha_atrio_audiencia(lote, onda, status);

INSERT INTO public.campanha_atrio_controle (onda, status, total_alvo, total_enviado, total_erros, lote)
VALUES
  (4, 'aguardando', 100, 0, 0, 2),
  (5, 'aguardando', 300, 0, 0, 2),
  (6, 'aguardando', 600, 0, 0, 2)
ON CONFLICT (onda) DO NOTHING;