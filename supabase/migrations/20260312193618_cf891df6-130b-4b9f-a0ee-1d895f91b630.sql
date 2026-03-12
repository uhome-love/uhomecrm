
-- RH Candidatos (Recruitment Kanban)
CREATE TABLE public.rh_candidatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  origem TEXT DEFAULT 'whatsapp',
  observacoes TEXT,
  etapa TEXT NOT NULL DEFAULT 'novo_lead',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_candidatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_candidatos_select" ON public.rh_candidatos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "rh_candidatos_insert" ON public.rh_candidatos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rh_candidatos_update" ON public.rh_candidatos
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "rh_candidatos_delete" ON public.rh_candidatos
  FOR DELETE TO authenticated USING (true);

-- RH Conversas 1:1
CREATE TABLE public.rh_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL,
  colaborador_nome TEXT NOT NULL,
  data_conversa DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL DEFAULT 'feedback',
  resumo TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_conversas_select" ON public.rh_conversas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "rh_conversas_insert" ON public.rh_conversas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rh_conversas_update" ON public.rh_conversas
  FOR UPDATE TO authenticated USING (true);

-- Sala de Reunião Reservas
CREATE TABLE public.sala_reuniao_reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  responsavel TEXT NOT NULL,
  assunto TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sala_reuniao_reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sala_reservas_select" ON public.sala_reuniao_reservas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sala_reservas_insert" ON public.sala_reuniao_reservas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "sala_reservas_update" ON public.sala_reuniao_reservas
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "sala_reservas_delete" ON public.sala_reuniao_reservas
  FOR DELETE TO authenticated USING (true);
