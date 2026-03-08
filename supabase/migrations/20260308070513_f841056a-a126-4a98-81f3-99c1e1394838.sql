
-- Create homi-documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('homi-documents', 'homi-documents', false, 52428800)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 52428800;

-- RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload homi docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'homi-documents');

-- RLS: authenticated users can read
CREATE POLICY "Authenticated users can read homi docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'homi-documents');

-- RLS: owner can delete
CREATE POLICY "Users can delete own homi docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'homi-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
