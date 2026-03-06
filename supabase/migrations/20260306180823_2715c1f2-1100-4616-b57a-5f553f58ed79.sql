-- Allow corretores to see their own team_members row (needed to resolve gerente_id)
CREATE POLICY "Corretores can view own team membership"
ON public.team_members
FOR SELECT
USING (user_id = auth.uid());