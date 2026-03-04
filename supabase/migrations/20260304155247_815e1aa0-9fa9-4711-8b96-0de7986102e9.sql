
-- Corretor daily goals table
CREATE TABLE public.corretor_daily_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  meta_ligacoes integer NOT NULL DEFAULT 30,
  meta_aproveitados integer NOT NULL DEFAULT 5,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(corretor_id, data)
);

ALTER TABLE public.corretor_daily_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Corretores can view own goals" ON public.corretor_daily_goals
  FOR SELECT TO authenticated USING (auth.uid() = corretor_id);

CREATE POLICY "Corretores can insert own goals" ON public.corretor_daily_goals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = corretor_id);

CREATE POLICY "Corretores can update own goals" ON public.corretor_daily_goals
  FOR UPDATE TO authenticated USING (auth.uid() = corretor_id);

CREATE POLICY "Admins and gestores can view all goals" ON public.corretor_daily_goals
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')
  );

-- Daily motivational messages table
CREATE TABLE public.corretor_motivations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  mensagem text NOT NULL,
  autor text DEFAULT 'sistema',
  fixada boolean NOT NULL DEFAULT false,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.corretor_motivations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view motivations" ON public.corretor_motivations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage motivations" ON public.corretor_motivations
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
