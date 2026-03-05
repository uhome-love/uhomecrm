
CREATE POLICY "Corretores can view own approved leads"
ON public.oferta_ativa_leads
FOR SELECT
TO authenticated
USING (corretor_id = auth.uid());
