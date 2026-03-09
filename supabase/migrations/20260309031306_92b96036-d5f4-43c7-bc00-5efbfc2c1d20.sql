
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS cargo_destino TEXT[] DEFAULT ARRAY['admin','gestor','corretor','backoffice'];
