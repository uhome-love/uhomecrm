-- Create storage bucket for pagadoria documents
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('pagadoria-docs', 'pagadoria-docs', false, 20971520)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload
CREATE POLICY "auth_upload_pagadoria_docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pagadoria-docs');

-- RLS: authenticated users can read their uploads
CREATE POLICY "auth_read_pagadoria_docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pagadoria-docs');

-- RLS: authenticated users can delete their uploads
CREATE POLICY "auth_delete_pagadoria_docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pagadoria-docs');