
-- Add approval workflow columns to corretor_daily_goals
ALTER TABLE public.corretor_daily_goals
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS meta_ligacoes_aprovada integer,
  ADD COLUMN IF NOT EXISTS meta_aproveitados_aprovada integer,
  ADD COLUMN IF NOT EXISTS feedback_gerente text;

-- Allow gestores to view and update corretor goals for approval
CREATE POLICY "Gestores can update corretor goals"
  ON public.corretor_daily_goals FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
