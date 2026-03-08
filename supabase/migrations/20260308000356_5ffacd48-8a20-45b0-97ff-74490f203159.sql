
CREATE TABLE public.coaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id uuid NOT NULL,
  lista_id uuid REFERENCES public.oferta_ativa_listas(id) ON DELETE SET NULL,
  session_start timestamptz NOT NULL,
  session_end timestamptz NOT NULL DEFAULT now(),
  duracao_segundos integer NOT NULL DEFAULT 0,
  total_tentativas integer NOT NULL DEFAULT 0,
  total_atenderam integer NOT NULL DEFAULT 0,
  total_aproveitados integer NOT NULL DEFAULT 0,
  taxa_atendimento numeric DEFAULT 0,
  taxa_aproveitamento numeric DEFAULT 0,
  media_corretor_30d jsonb DEFAULT '{}'::jsonb,
  media_time_hoje jsonb DEFAULT '{}'::jsonb,
  feedback_ia text,
  metricas jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Corretores can view own coaching sessions"
  ON public.coaching_sessions FOR SELECT
  TO authenticated
  USING (corretor_id = auth.uid());

CREATE POLICY "Corretores can insert own coaching sessions"
  ON public.coaching_sessions FOR INSERT
  TO authenticated
  WITH CHECK (corretor_id = auth.uid());

CREATE POLICY "Corretores can update own coaching sessions"
  ON public.coaching_sessions FOR UPDATE
  TO authenticated
  USING (corretor_id = auth.uid());

CREATE POLICY "Gestores can view all coaching sessions"
  ON public.coaching_sessions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
