
-- Table to track corretor availability and segment selection for the lead roulette
CREATE TABLE public.corretor_disponibilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'na_empresa', 'em_pausa', 'em_visita')),
  segmentos text[] NOT NULL DEFAULT '{}',
  na_roleta boolean NOT NULL DEFAULT false,
  entrada_em timestamptz,
  saida_em timestamptz,
  leads_recebidos_turno integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.corretor_disponibilidade ENABLE ROW LEVEL SECURITY;

-- Corretores can view and manage their own availability
CREATE POLICY "Users can view own disponibilidade"
  ON public.corretor_disponibilidade FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own disponibilidade"
  ON public.corretor_disponibilidade FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own disponibilidade"
  ON public.corretor_disponibilidade FOR UPDATE
  USING (auth.uid() = user_id);

-- Gestores and admins can view all
CREATE POLICY "Gestores can view all disponibilidade"
  ON public.corretor_disponibilidade FOR SELECT
  USING (has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage all
CREATE POLICY "Admins can manage disponibilidade"
  ON public.corretor_disponibilidade FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.corretor_disponibilidade;
