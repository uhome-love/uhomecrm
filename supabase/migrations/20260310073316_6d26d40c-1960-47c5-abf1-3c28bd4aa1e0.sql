
-- Drop the overly restrictive policy that requires 'gestor' role
DROP POLICY IF EXISTS "Admins and gestores can view all goals" ON public.corretor_daily_goals;

-- Create a policy that allows gerentes to view goals of their team members
CREATE POLICY "Gerentes can view team goals"
ON public.corretor_daily_goals
FOR SELECT
TO authenticated
USING (
  auth.uid() = corretor_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.user_id = corretor_daily_goals.corretor_id
      AND tm.gerente_id = auth.uid()
      AND tm.status = 'ativo'
  )
);

-- Also drop the now-redundant "Corretores can view own goals" since the new policy covers it
DROP POLICY IF EXISTS "Corretores can view own goals" ON public.corretor_daily_goals;
