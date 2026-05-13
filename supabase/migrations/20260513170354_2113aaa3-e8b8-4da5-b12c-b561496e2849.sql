ALTER TABLE public.reengajamento_config
  ADD COLUMN IF NOT EXISTS meta_header_image_url TEXT,
  ADD COLUMN IF NOT EXISTS meta_header_image_url_2 TEXT;