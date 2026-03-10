
-- Fix RLS policy for checkpoint_diario: gerente needs INSERT + UPDATE access
-- The existing policy checks profiles.id = auth.uid() which is wrong (profiles.id != auth.uid())
DROP POLICY IF EXISTS "gerente_full_access" ON public.checkpoint_diario;

CREATE POLICY "gerente_full_access" ON public.checkpoint_diario
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.cargo = ANY (ARRAY['gerente', 'admin', 'ceo'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.cargo = ANY (ARRAY['gerente', 'admin', 'ceo'])
  )
);
