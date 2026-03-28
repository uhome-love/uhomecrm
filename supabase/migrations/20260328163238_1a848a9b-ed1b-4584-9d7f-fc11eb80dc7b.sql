ALTER TABLE public.vitrines 
  ADD COLUMN IF NOT EXISTS imovel_codigos text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS corretor_slug text,
  ADD COLUMN IF NOT EXISTS corretor_id uuid,
  ADD COLUMN IF NOT EXISTS mensagem text;