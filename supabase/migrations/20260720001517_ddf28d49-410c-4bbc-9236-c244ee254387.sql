ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS faixa_valor text,
  ADD COLUMN IF NOT EXISTS prazo_decisao text;