-- Fix: Allow gestores to delete team visitas
CREATE POLICY "Gestores can delete team visitas"
ON public.visitas FOR DELETE
TO authenticated
USING (gerente_id = auth.uid());

-- Fix: Gestores UPDATE policy missing with_check
DROP POLICY IF EXISTS "Gestores can update team visitas" ON public.visitas;
CREATE POLICY "Gestores can update team visitas"
ON public.visitas FOR UPDATE
TO authenticated
USING (gerente_id = auth.uid())
WITH CHECK (gerente_id = auth.uid());