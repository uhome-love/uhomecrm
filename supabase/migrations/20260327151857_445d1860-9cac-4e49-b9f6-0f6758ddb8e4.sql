CREATE POLICY "Public can view visitas for scoreboard"
ON public.visitas
FOR SELECT
TO anon
USING (true);