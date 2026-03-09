
-- Add INSERT policy for gestores on visitas (they manage team visits)
CREATE POLICY "Gestores can insert team visitas"
ON public.visitas FOR INSERT
TO authenticated
WITH CHECK (
  gerente_id = auth.uid()
  OR has_role(auth.uid(), 'admin')
);
