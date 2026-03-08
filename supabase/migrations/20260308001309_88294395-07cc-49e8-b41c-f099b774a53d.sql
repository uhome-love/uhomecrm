
-- Table to persist unlocked achievements
CREATE TABLE public.corretor_conquistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conquista_id text NOT NULL,
  desbloqueada_em timestamp with time zone NOT NULL DEFAULT now(),
  notificado boolean NOT NULL DEFAULT false,
  UNIQUE(user_id, conquista_id)
);

ALTER TABLE public.corretor_conquistas ENABLE ROW LEVEL SECURITY;

-- Corretores can view own
CREATE POLICY "Users can view own conquistas"
  ON public.corretor_conquistas FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Corretores can insert own
CREATE POLICY "Users can insert own conquistas"
  ON public.corretor_conquistas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Corretores can update own (for notificado flag)
CREATE POLICY "Users can update own conquistas"
  ON public.corretor_conquistas FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Gestores/admins can view all for team visibility
CREATE POLICY "Gestores can view all conquistas"
  ON public.corretor_conquistas FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
