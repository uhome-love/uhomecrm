
-- Add visibilidade to academia_trilhas
ALTER TABLE public.academia_trilhas ADD COLUMN IF NOT EXISTS visibilidade TEXT DEFAULT 'todos';

-- Add conteudo JSONB to academia_aulas for rich content storage
ALTER TABLE public.academia_aulas ADD COLUMN IF NOT EXISTS conteudo JSONB;

-- Create storage buckets for academia content
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('academia-videos', 'academia-videos', false, 524288000, ARRAY['video/mp4','video/webm','video/quicktime']),
  ('academia-pdfs', 'academia-pdfs', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for academia-videos
CREATE POLICY "Authenticated upload academia videos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'academia-videos');

CREATE POLICY "Authenticated read academia videos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'academia-videos');

CREATE POLICY "Authenticated delete academia videos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'academia-videos');

-- Storage policies for academia-pdfs
CREATE POLICY "Authenticated upload academia pdfs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'academia-pdfs');

CREATE POLICY "Authenticated read academia pdfs" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'academia-pdfs');

CREATE POLICY "Authenticated delete academia pdfs" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'academia-pdfs');
