INSERT INTO storage.buckets (id, name, public) VALUES ('empreendimentos', 'empreendimentos', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read empreendimentos" ON storage.objects FOR SELECT USING (bucket_id = 'empreendimentos');
CREATE POLICY "Auth upload empreendimentos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'empreendimentos' AND auth.role() = 'authenticated');