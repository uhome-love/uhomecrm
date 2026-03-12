
-- Add landing page fields to empreendimento_overrides
ALTER TABLE public.empreendimento_overrides
  ADD COLUMN IF NOT EXISTS diferenciais text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS plantas text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS mapa_url text,
  ADD COLUMN IF NOT EXISTS cor_primaria text DEFAULT '#1e3a5f',
  ADD COLUMN IF NOT EXISTS landing_titulo text,
  ADD COLUMN IF NOT EXISTS landing_subtitulo text;

-- Create storage bucket for landing page assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-assets', 'landing-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to landing-assets
CREATE POLICY "Authenticated users can upload landing assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'landing-assets');

-- Allow public read access to landing assets
CREATE POLICY "Public read landing assets"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'landing-assets');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete landing assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'landing-assets');
