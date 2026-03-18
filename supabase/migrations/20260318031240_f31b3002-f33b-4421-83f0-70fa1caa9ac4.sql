
-- ═══════════════════════════════════════════════════════════
-- Espelho local de imóveis (fonte: Jetimob → Typesense → PG)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jetimob_id TEXT UNIQUE,
  codigo TEXT UNIQUE NOT NULL,
  titulo TEXT,
  descricao TEXT,
  tipo TEXT,
  finalidade TEXT[],
  contrato TEXT DEFAULT 'venda',
  situacao TEXT,

  -- Localização
  endereco TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT DEFAULT 'Porto Alegre',
  estado TEXT DEFAULT 'RS',
  cep TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  regiao TEXT,

  -- Números
  dormitorios INT,
  suites INT,
  banheiros INT,
  vagas INT,
  area_privativa NUMERIC(10,2),
  area_total NUMERIC(10,2),
  andar INT,

  -- Valores
  valor_venda NUMERIC(14,2),
  valor_locacao NUMERIC(14,2),
  valor_condominio NUMERIC(10,2),
  valor_iptu NUMERIC(10,2),

  -- Empreendimento
  empreendimento TEXT,
  construtora TEXT,

  -- Comercial
  peso_comercial INT DEFAULT 0,
  campanha_ativa TEXT,
  comissao_percentual NUMERIC(5,2),
  estoque_status TEXT,
  is_uhome BOOLEAN DEFAULT false,
  is_destaque BOOLEAN DEFAULT false,
  is_exclusivo BOOLEAN DEFAULT false,
  aceita_financiamento BOOLEAN,
  is_mcmv BOOLEAN DEFAULT false,

  -- Features e mídia
  features JSONB DEFAULT '{}',
  tags TEXT[],
  posicao_solar TEXT,
  fotos TEXT[],
  fotos_full TEXT[],
  tour_virtual_url TEXT,
  video_url TEXT,

  -- Sync
  jetimob_raw JSONB,
  sync_hash TEXT,
  synced_at TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT true,
  inativado_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_properties_codigo ON public.properties(codigo);
CREATE INDEX idx_properties_bairro ON public.properties(bairro);
CREATE INDEX idx_properties_tipo ON public.properties(tipo);
CREATE INDEX idx_properties_ativo ON public.properties(ativo) WHERE ativo = true;
CREATE INDEX idx_properties_valor_venda ON public.properties(valor_venda) WHERE ativo = true;
CREATE INDEX idx_properties_synced ON public.properties(synced_at);
CREATE INDEX idx_properties_empreendimento ON public.properties(empreendimento);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read properties"
  ON public.properties FOR SELECT TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════
-- Histórico de preços
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.property_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  campo TEXT NOT NULL,
  valor_anterior NUMERIC(14,2),
  valor_novo NUMERIC(14,2),
  variacao_pct NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_price_hist_prop ON public.property_price_history(property_id, created_at DESC);

ALTER TABLE public.property_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read price history"
  ON public.property_price_history FOR SELECT TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════
-- Log de sincronização
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.property_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  total_api INT DEFAULT 0,
  novos INT DEFAULT 0,
  atualizados INT DEFAULT 0,
  inativados INT DEFAULT 0,
  erros INT DEFAULT 0,
  detalhes JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duracao_ms INT
);

ALTER TABLE public.property_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read sync logs"
  ON public.property_sync_log FOR SELECT TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════
-- Perfil de interesse do lead
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.lead_property_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  
  objetivo TEXT[],
  momento_compra TEXT,
  urgencia TEXT,
  
  valor_min NUMERIC(14,2),
  valor_max NUMERIC(14,2),
  valor_ideal NUMERIC(14,2),
  bairros TEXT[],
  regioes TEXT[],
  tipos TEXT[],
  area_min NUMERIC(10,2),
  area_max NUMERIC(10,2),
  dormitorios_min INT,
  suites_min INT,
  vagas_min INT,
  
  itens_obrigatorios TEXT[],
  itens_desejaveis TEXT[],
  rejeicoes TEXT[],
  
  aceita_financiamento BOOLEAN,
  renda_familiar NUMERIC(14,2),
  possui_imovel_troca BOOLEAN,
  
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(lead_id)
);

ALTER TABLE public.lead_property_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage lead property profiles"
  ON public.lead_property_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════
-- Histórico de buscas por lead
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.lead_property_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  corretor_id UUID NOT NULL,
  
  query_text TEXT,
  filters JSONB,
  sort_by TEXT,
  total_results INT,
  result_codes TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lead_searches ON public.lead_property_searches(lead_id, created_at DESC);

ALTER TABLE public.lead_property_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage lead searches"
  ON public.lead_property_searches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════
-- Interações do corretor com imóveis por lead
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.lead_property_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  property_code TEXT NOT NULL,
  corretor_id UUID NOT NULL,
  
  acao TEXT NOT NULL,
  canal_envio TEXT,
  motivo_descarte TEXT,
  feedback_lead TEXT,
  notas TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lead_prop_inter ON public.lead_property_interactions(lead_id, property_code);
CREATE INDEX idx_lead_prop_acao ON public.lead_property_interactions(lead_id, acao);

ALTER TABLE public.lead_property_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage lead property interactions"
  ON public.lead_property_interactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
