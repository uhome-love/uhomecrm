-- Tabela de catálogo de imóveis sincronizada do Jetimob
CREATE TABLE IF NOT EXISTS public.imoveis_catalog (
  codigo TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  titulo TEXT,
  empreendimento TEXT,
  bairro TEXT,
  tipo TEXT,
  contrato TEXT,
  valor_venda NUMERIC,
  valor_locacao NUMERIC,
  dormitorios INTEGER,
  suites INTEGER,
  vagas INTEGER,
  area NUMERIC,
  situacao TEXT,
  is_uhome BOOLEAN DEFAULT false,
  search_text TEXT,
  fotos_thumbs JSONB DEFAULT '[]'::jsonb,
  fotos_full JSONB DEFAULT '[]'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance de filtros
CREATE INDEX IF NOT EXISTS idx_imoveis_catalog_bairro ON public.imoveis_catalog (bairro);
CREATE INDEX IF NOT EXISTS idx_imoveis_catalog_tipo ON public.imoveis_catalog (tipo);
CREATE INDEX IF NOT EXISTS idx_imoveis_catalog_valor_venda ON public.imoveis_catalog (valor_venda);
CREATE INDEX IF NOT EXISTS idx_imoveis_catalog_dorms ON public.imoveis_catalog (dormitorios);
CREATE INDEX IF NOT EXISTS idx_imoveis_catalog_uhome ON public.imoveis_catalog (is_uhome) WHERE is_uhome = true;
CREATE INDEX IF NOT EXISTS idx_imoveis_catalog_synced_at ON public.imoveis_catalog (synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_imoveis_catalog_search ON public.imoveis_catalog USING gin (to_tsvector('portuguese', coalesce(search_text, '')));

-- Tabela de status do sync
CREATE TABLE IF NOT EXISTS public.imoveis_catalog_sync_status (
  id INTEGER PRIMARY KEY DEFAULT 1,
  ultimo_sync_iniciado_em TIMESTAMPTZ,
  ultimo_sync_concluido_em TIMESTAMPTZ,
  ultimo_sync_status TEXT,
  ultimo_sync_total INTEGER,
  ultimo_sync_erro TEXT,
  duracao_ms INTEGER,
  CHECK (id = 1)
);

INSERT INTO public.imoveis_catalog_sync_status (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS: leitura pública (já que já são dados públicos do site), escrita só service role
ALTER TABLE public.imoveis_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imoveis_catalog_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Imoveis catalog readable by authenticated"
ON public.imoveis_catalog FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Sync status readable by authenticated"
ON public.imoveis_catalog_sync_status FOR SELECT
TO authenticated
USING (true);