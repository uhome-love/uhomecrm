
-- ==============================================
-- PIPELINE LEADS - Tabela principal
-- ==============================================

CREATE TABLE public.pipeline_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dados do lead
  nome text NOT NULL,
  telefone text,
  telefone2 text,
  email text,
  
  -- Classificação
  segmento_id uuid REFERENCES public.pipeline_segmentos(id),
  produto_id uuid REFERENCES public.pipeline_produtos(id),
  empreendimento text,
  
  -- Pipeline state
  stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id),
  stage_changed_at timestamptz NOT NULL DEFAULT now(),
  ordem_no_stage integer NOT NULL DEFAULT 0,
  
  -- Atribuição
  corretor_id uuid, -- user_id do corretor atribuído
  distribuido_em timestamptz, -- quando foi distribuído pela roleta
  aceito_em timestamptz, -- quando o corretor aceitou
  aceite_expira_em timestamptz, -- deadline para aceitar
  
  -- Origem
  origem text, -- meta_ads, tiktok, portal, site, indicacao, etc
  origem_detalhe text, -- nome da campanha, portal específico, etc
  jetimob_lead_id text, -- ID do lead no Jetimob para dedup
  
  -- Contexto
  observacoes text,
  proxima_acao text,
  data_proxima_acao date,
  motivo_descarte text,
  valor_estimado numeric,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid -- quem criou (pode ser sistema via sync)
);

-- Índices para performance
CREATE INDEX idx_pipeline_leads_corretor ON public.pipeline_leads(corretor_id);
CREATE INDEX idx_pipeline_leads_stage ON public.pipeline_leads(stage_id);
CREATE INDEX idx_pipeline_leads_segmento ON public.pipeline_leads(segmento_id);
CREATE INDEX idx_pipeline_leads_jetimob ON public.pipeline_leads(jetimob_lead_id);
CREATE UNIQUE INDEX idx_pipeline_leads_jetimob_unique ON public.pipeline_leads(jetimob_lead_id) WHERE jetimob_lead_id IS NOT NULL;

ALTER TABLE public.pipeline_leads ENABLE ROW LEVEL SECURITY;

-- Corretores veem apenas leads atribuídos a eles
CREATE POLICY "Corretores can view own pipeline leads"
  ON public.pipeline_leads FOR SELECT
  TO authenticated
  USING (corretor_id = auth.uid());

-- Corretores podem atualizar leads atribuídos (mover no kanban)
CREATE POLICY "Corretores can update own pipeline leads"
  ON public.pipeline_leads FOR UPDATE
  TO authenticated
  USING (corretor_id = auth.uid());

-- Gestores podem ver todos os leads (para gestão)
CREATE POLICY "Gestores can view all pipeline leads"
  ON public.pipeline_leads FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin'));

-- Gestores e admins podem inserir leads (distribuição, sync)
CREATE POLICY "Gestores can insert pipeline leads"
  ON public.pipeline_leads FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin'));

-- Gestores e admins podem atualizar qualquer lead
CREATE POLICY "Gestores can update all pipeline leads"
  ON public.pipeline_leads FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin'));

-- Apenas admins podem deletar
CREATE POLICY "Admins can delete pipeline leads"
  ON public.pipeline_leads FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_pipeline_leads_updated_at
  BEFORE UPDATE ON public.pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
