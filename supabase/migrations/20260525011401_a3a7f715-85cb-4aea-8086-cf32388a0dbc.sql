CREATE POLICY "Gestores can view team_members visitas"
ON public.visitas FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.gerente_id = auth.uid()
      AND tm.user_id    = visitas.corretor_id
      AND tm.status     = 'ativo'
  )
);