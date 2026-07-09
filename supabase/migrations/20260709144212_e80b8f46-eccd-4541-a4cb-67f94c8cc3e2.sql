ALTER TABLE public.pdn_entries
  ADD COLUMN IF NOT EXISTS proxima_acao_data date,
  ADD COLUMN IF NOT EXISTS prioridade text,
  ADD COLUMN IF NOT EXISTS risco_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS risco_motivo text;