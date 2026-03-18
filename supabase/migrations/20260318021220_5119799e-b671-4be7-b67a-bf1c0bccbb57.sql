-- Allow corretors to view visitas from their teammates (same gerente)
CREATE POLICY "Corretores can view team visitas"
ON public.visitas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_members my_team
    JOIN team_members teammate ON teammate.gerente_id = my_team.gerente_id
    WHERE my_team.user_id = auth.uid()
      AND my_team.status = 'ativo'
      AND teammate.user_id = visitas.corretor_id
      AND teammate.status = 'ativo'
  )
);