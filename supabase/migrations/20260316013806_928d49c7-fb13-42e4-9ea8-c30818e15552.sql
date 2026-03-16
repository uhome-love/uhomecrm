INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-images', 'campaign-images', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read campaign images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'campaign-images');

CREATE POLICY "Auth users upload campaign images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'campaign-images');