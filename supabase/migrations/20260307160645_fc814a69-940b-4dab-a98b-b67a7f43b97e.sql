ALTER TABLE public.pdn_entries 
  ADD COLUMN IF NOT EXISTS objecao_cliente text DEFAULT NULL;