DROP POLICY IF EXISTS "Diretores can view managed teams visitas" ON public.visitas;

CREATE POLICY "Diretores can view all visitas"
ON public.visitas
FOR SELECT
USING (has_role(auth.uid(), 'diretor'::app_role));