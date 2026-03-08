
-- Commission tiers (editable by admin/backoffice)
CREATE TABLE public.comissao_faixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT 'Padrão',
  vgv_min numeric NOT NULL DEFAULT 0,
  vgv_max numeric,
  percentual numeric NOT NULL DEFAULT 32,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comissao_faixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backoffice and admins can manage faixas" ON public.comissao_faixas
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'backoffice'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'backoffice'::app_role));

CREATE POLICY "Authenticated can view faixas" ON public.comissao_faixas
FOR SELECT TO authenticated USING (true);

-- Pagadorias
CREATE TABLE public.pagadorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome text NOT NULL,
  cliente_cpf text,
  cliente_email text,
  cliente_telefone text,
  cliente_endereco text,
  empreendimento text NOT NULL,
  unidade text,
  vgv numeric NOT NULL DEFAULT 0,
  data_venda date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento text NOT NULL DEFAULT 'a_vista',
  parcelas_config jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'rascunho',
  docusign_link text,
  criada_por uuid NOT NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pagadorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backoffice and admins can manage pagadorias" ON public.pagadorias
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'backoffice'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'backoffice'::app_role));

-- Pagadoria credores
CREATE TABLE public.pagadoria_credores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagadoria_id uuid NOT NULL REFERENCES public.pagadorias(id) ON DELETE CASCADE,
  credor_tipo text NOT NULL DEFAULT 'corretor',
  credor_nome text NOT NULL,
  credor_id uuid,
  percentual numeric NOT NULL DEFAULT 0,
  valor numeric NOT NULL DEFAULT 0,
  parcelas jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pagadoria_credores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backoffice and admins can manage credores" ON public.pagadoria_credores
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'backoffice'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'backoffice'::app_role));

CREATE POLICY "Authenticated can view credores" ON public.pagadoria_credores
FOR SELECT TO authenticated USING (true);

-- Marketing content calendar
CREATE TABLE public.conteudos_marketing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'post_estatico',
  plataforma text[] NOT NULL DEFAULT '{instagram}'::text[],
  tema text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'planejado',
  data_publicacao timestamptz,
  brief jsonb DEFAULT '{}'::jsonb,
  criado_por uuid NOT NULL,
  aprovado_por uuid,
  aprovado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conteudos_marketing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backoffice and admins can manage conteudos" ON public.conteudos_marketing
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'backoffice'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'backoffice'::app_role));

CREATE POLICY "Authenticated can view conteudos" ON public.conteudos_marketing
FOR SELECT TO authenticated USING (true);

-- Backoffice tasks (gamification)
CREATE TABLE public.backoffice_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL,
  categoria text NOT NULL DEFAULT 'financeiro',
  status text NOT NULL DEFAULT 'pendente',
  data date NOT NULL DEFAULT CURRENT_DATE,
  concluida_em timestamptz,
  pontos integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.backoffice_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own backoffice tasks" ON public.backoffice_tasks
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all backoffice tasks" ON public.backoffice_tasks
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default commission tiers
INSERT INTO public.comissao_faixas (nome, vgv_min, vgv_max, percentual) VALUES
  ('Faixa 1', 0, 1500000, 32),
  ('Faixa 2', 1500000, 3000000, 34),
  ('Faixa 3', 3000000, NULL, 36);
