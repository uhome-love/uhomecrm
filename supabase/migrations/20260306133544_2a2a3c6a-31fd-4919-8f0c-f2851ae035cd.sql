
-- Create visitas table
CREATE TABLE public.visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id uuid NOT NULL,
  gerente_id uuid NOT NULL,
  lead_id uuid REFERENCES public.oferta_ativa_leads(id) ON DELETE SET NULL,
  nome_cliente text NOT NULL,
  telefone text,
  empreendimento text,
  origem text NOT NULL DEFAULT 'manual',
  origem_detalhe text,
  data_visita date NOT NULL,
  hora_visita time,
  local_visita text,
  status text NOT NULL DEFAULT 'marcada',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  linked_attempt_id uuid REFERENCES public.oferta_ativa_tentativas(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX idx_visitas_corretor ON public.visitas(corretor_id);
CREATE INDEX idx_visitas_gerente ON public.visitas(gerente_id);
CREATE INDEX idx_visitas_status ON public.visitas(status);
CREATE INDEX idx_visitas_data ON public.visitas(data_visita);

-- Enable RLS
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

-- Corretor: own visitas
CREATE POLICY "Corretores can view own visitas"
  ON public.visitas FOR SELECT
  USING (corretor_id = auth.uid());

CREATE POLICY "Corretores can insert own visitas"
  ON public.visitas FOR INSERT
  WITH CHECK (corretor_id = auth.uid());

CREATE POLICY "Corretores can update own visitas"
  ON public.visitas FOR UPDATE
  USING (corretor_id = auth.uid());

-- Gestor: team visitas
CREATE POLICY "Gestores can view team visitas"
  ON public.visitas FOR SELECT
  USING (gerente_id = auth.uid());

-- Admin: all
CREATE POLICY "Admins can manage all visitas"
  ON public.visitas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_visitas_updated_at
  BEFORE UPDATE ON public.visitas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.visitas;
