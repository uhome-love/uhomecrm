
-- Oferta Ativa: Listas importadas
CREATE TABLE public.oferta_ativa_listas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  empreendimento text NOT NULL,
  campanha text,
  origem text,
  status text NOT NULL DEFAULT 'pendente',
  max_tentativas integer NOT NULL DEFAULT 3,
  cooldown_dias integer NOT NULL DEFAULT 7,
  total_leads integer NOT NULL DEFAULT 0,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.oferta_ativa_listas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage listas" ON public.oferta_ativa_listas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores can view listas" ON public.oferta_ativa_listas
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'gestor'));

CREATE POLICY "Corretores can view liberadas" ON public.oferta_ativa_listas
  FOR SELECT TO authenticated
  USING (status = 'liberada');

-- Oferta Ativa: Leads importados
CREATE TABLE public.oferta_ativa_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id uuid REFERENCES public.oferta_ativa_listas(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  telefone text,
  telefone2 text,
  email text,
  telefone_normalizado text,
  empreendimento text,
  campanha text,
  origem text,
  data_lead date,
  observacoes text,
  status text NOT NULL DEFAULT 'na_fila',
  motivo_descarte text,
  corretor_id uuid,
  jetimob_id text,
  cadastrado_jetimob boolean NOT NULL DEFAULT false,
  cadastrado_jetimob_em timestamptz,
  tentativas_count integer NOT NULL DEFAULT 0,
  ultima_tentativa timestamptz,
  proxima_tentativa_apos timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oa_leads_telefone_norm ON public.oferta_ativa_leads(telefone_normalizado);
CREATE INDEX idx_oa_leads_email ON public.oferta_ativa_leads(email);
CREATE INDEX idx_oa_leads_status ON public.oferta_ativa_leads(status);
CREATE INDEX idx_oa_leads_lista ON public.oferta_ativa_leads(lista_id);

ALTER TABLE public.oferta_ativa_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage leads" ON public.oferta_ativa_leads
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores can view leads" ON public.oferta_ativa_leads
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'gestor'));

CREATE POLICY "Corretores can view fila leads" ON public.oferta_ativa_leads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.oferta_ativa_listas l
      WHERE l.id = oferta_ativa_leads.lista_id AND l.status = 'liberada'
    )
  );

CREATE POLICY "Corretores can update assigned leads" ON public.oferta_ativa_leads
  FOR UPDATE TO authenticated
  USING (corretor_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Oferta Ativa: Log de tentativas
CREATE TABLE public.oferta_ativa_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.oferta_ativa_leads(id) ON DELETE CASCADE NOT NULL,
  corretor_id uuid NOT NULL,
  lista_id uuid REFERENCES public.oferta_ativa_listas(id),
  empreendimento text,
  canal text NOT NULL,
  resultado text NOT NULL,
  feedback text NOT NULL,
  pontos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oa_tentativas_corretor ON public.oferta_ativa_tentativas(corretor_id);
CREATE INDEX idx_oa_tentativas_lead ON public.oferta_ativa_tentativas(lead_id);
CREATE INDEX idx_oa_tentativas_data ON public.oferta_ativa_tentativas(created_at);

ALTER TABLE public.oferta_ativa_tentativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own tentativas" ON public.oferta_ativa_tentativas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = corretor_id);

CREATE POLICY "Users can view own tentativas" ON public.oferta_ativa_tentativas
  FOR SELECT TO authenticated
  USING (
    corretor_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'gestor')
  );

-- Oferta Ativa: Templates de mensagem
CREATE TABLE public.oferta_ativa_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empreendimento text,
  tipo text NOT NULL,
  canal text NOT NULL,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.oferta_ativa_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage templates" ON public.oferta_ativa_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "All authenticated can view templates" ON public.oferta_ativa_templates
  FOR SELECT TO authenticated
  USING (true);
