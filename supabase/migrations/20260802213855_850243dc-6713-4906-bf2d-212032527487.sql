CREATE POLICY "homi anexos own upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'homi-anexos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "homi anexos own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'homi-anexos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "homi anexos own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'homi-anexos' AND (storage.foldername(name))[1] = auth.uid()::text);