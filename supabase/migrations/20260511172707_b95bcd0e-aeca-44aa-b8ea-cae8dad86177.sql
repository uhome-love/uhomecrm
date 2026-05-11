ALTER TABLE public.reengajamento_config 
ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false;