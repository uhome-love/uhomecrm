
-- ==============================================
-- PIPELINE COMERCIAL - Tabelas Base
-- ==============================================

-- 1. Segmentos de mercado (configurável)
CREATE TABLE public.pipeline_segmentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  cor text DEFAULT '#3b82f6',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_segmentos ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ver segmentos (precisam para o kanban)
CREATE POLICY "Authenticated can view segmentos"
  ON public.pipeline_segmentos FOR SELECT
  TO authenticated
  USING (true);

-- Apenas admins podem gerenciar
CREATE POLICY "Admins can manage segmentos"
  ON public.pipeline_segmentos FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 2. Produtos vinculados a segmentos
CREATE TABLE public.pipeline_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segmento_id uuid NOT NULL REFERENCES public.pipeline_segmentos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view produtos"
  ON public.pipeline_produtos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage produtos"
  ON public.pipeline_produtos FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 3. Estágios do pipeline (configuráveis, com ordem)
CREATE TYPE public.pipeline_stage_type AS ENUM (
  'novo_lead',
  'sem_contato', 
  'atendimento_inicial',
  'qualificacao_busca',
  'visita',
  'proposta',
  'venda',
  'descarte'
);

CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo pipeline_stage_type NOT NULL,
  cor text DEFAULT '#6b7280',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view stages"
  ON public.pipeline_stages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage stages"
  ON public.pipeline_stages FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Inserir estágios padrão
INSERT INTO public.pipeline_stages (nome, tipo, cor, ordem) VALUES
  ('Novos Leads', 'novo_lead', '#8b5cf6', 0),
  ('Sem Contato', 'sem_contato', '#ef4444', 1),
  ('Atendimento Inicial', 'atendimento_inicial', '#f97316', 2),
  ('Qualificação & Busca', 'qualificacao_busca', '#eab308', 3),
  ('Visita', 'visita', '#3b82f6', 4),
  ('Proposta', 'proposta', '#06b6d4', 5),
  ('Venda', 'venda', '#22c55e', 6),
  ('Descarte', 'descarte', '#6b7280', 7);
