-- Allow corretores to see checkpoints of their gerente (for ranking visibility)
CREATE POLICY "Corretores can view team checkpoints"
ON public.checkpoints
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.gerente_id = checkpoints.gerente_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'ativo'
  )
);

-- Allow corretores to see checkpoint_lines of their team (for ranking visibility)
CREATE POLICY "Corretores can view team checkpoint lines"
ON public.checkpoint_lines
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.checkpoints c
    JOIN public.team_members tm ON tm.gerente_id = c.gerente_id
    WHERE c.id = checkpoint_lines.checkpoint_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'ativo'
  )
);