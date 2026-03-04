
ALTER TABLE public.checkpoint_lines ADD COLUMN IF NOT EXISTS real_leads integer DEFAULT NULL;
ALTER TABLE public.checkpoint_lines ADD COLUMN IF NOT EXISTS meta_leads integer DEFAULT 0;
