CREATE POLICY "Diretor select candidatos"
ON public.rh_candidatos
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Diretor select entrevistas"
ON public.rh_entrevistas
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'diretor'));