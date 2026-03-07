
-- Pipeline lead activities table
CREATE TABLE public.pipeline_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_lead_id uuid NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'ligacao',
  titulo text NOT NULL,
  descricao text,
  data date NOT NULL DEFAULT CURRENT_DATE,
  hora time,
  prioridade text NOT NULL DEFAULT 'media',
  responsavel_id uuid,
  status text NOT NULL DEFAULT 'pendente',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pipeline lead notes table
CREATE TABLE public.pipeline_anotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_lead_id uuid NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  conteudo text NOT NULL,
  autor_id uuid NOT NULL,
  autor_nome text,
  fixada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pipeline lead tasks table
CREATE TABLE public.pipeline_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_lead_id uuid NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  prioridade text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'pendente',
  responsavel_id uuid,
  vence_em date,
  concluida_em timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add commercial data columns to pipeline_leads
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS objetivo_cliente text,
  ADD COLUMN IF NOT EXISTS bairro_regiao text,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS imovel_troca boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nivel_interesse text DEFAULT 'medio',
  ADD COLUMN IF NOT EXISTS temperatura text DEFAULT 'morno',
  ADD COLUMN IF NOT EXISTS hora_proxima_acao time,
  ADD COLUMN IF NOT EXISTS prioridade_acao text DEFAULT 'media';

-- Enable RLS on new tables
ALTER TABLE public.pipeline_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_anotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_tarefas ENABLE ROW LEVEL SECURITY;

-- RLS for pipeline_atividades
CREATE POLICY "Gestores can manage atividades" ON public.pipeline_atividades FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Corretores can view own atividades" ON public.pipeline_atividades FOR SELECT
  USING (created_by = auth.uid() OR responsavel_id = auth.uid());

CREATE POLICY "Corretores can insert own atividades" ON public.pipeline_atividades FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Corretores can update own atividades" ON public.pipeline_atividades FOR UPDATE
  USING (created_by = auth.uid() OR responsavel_id = auth.uid());

-- RLS for pipeline_anotacoes
CREATE POLICY "Gestores can manage anotacoes" ON public.pipeline_anotacoes FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Corretores can view own anotacoes" ON public.pipeline_anotacoes FOR SELECT
  USING (autor_id = auth.uid());

CREATE POLICY "Corretores can insert own anotacoes" ON public.pipeline_anotacoes FOR INSERT
  WITH CHECK (autor_id = auth.uid());

-- RLS for pipeline_tarefas
CREATE POLICY "Gestores can manage tarefas" ON public.pipeline_tarefas FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Corretores can view own tarefas" ON public.pipeline_tarefas FOR SELECT
  USING (created_by = auth.uid() OR responsavel_id = auth.uid());

CREATE POLICY "Corretores can insert own tarefas" ON public.pipeline_tarefas FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Corretores can update own tarefas" ON public.pipeline_tarefas FOR UPDATE
  USING (created_by = auth.uid() OR responsavel_id = auth.uid());

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_atividades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_anotacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_tarefas;
