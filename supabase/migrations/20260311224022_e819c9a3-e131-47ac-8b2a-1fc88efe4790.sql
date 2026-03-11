
CREATE TABLE public.integracao_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria TEXT NOT NULL CHECK (categoria IN ('leads', 'imoveis')),
  jetimob_field TEXT NOT NULL,
  jetimob_description TEXT,
  uhome_field TEXT NOT NULL DEFAULT '',
  uhome_table TEXT NOT NULL DEFAULT '',
  transform TEXT,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'warning', 'missing')),
  notes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.integracao_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access" ON public.integracao_field_mappings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read" ON public.integracao_field_mappings
  FOR SELECT TO authenticated USING (true);

-- Seed lead mappings
INSERT INTO public.integracao_field_mappings (categoria, jetimob_field, jetimob_description, uhome_field, uhome_table, transform, status, notes, ordem) VALUES
('leads', 'full_name / name / nome', 'Nome completo do lead', 'nome', 'pipeline_leads', NULL, 'ok', NULL, 1),
('leads', 'phones[0]', 'Telefone principal', 'telefone', 'pipeline_leads', NULL, 'ok', NULL, 2),
('leads', 'phones[1]', 'Telefone secundário', 'telefone2', 'pipeline_leads', NULL, 'ok', NULL, 3),
('leads', 'emails[0]', 'E-mail principal', 'email', 'pipeline_leads', NULL, 'ok', NULL, 4),
('leads', 'message', 'Mensagem do formulário', 'observacoes', 'pipeline_leads', 'Texto livre; usado para extrair campanha', 'ok', NULL, 5),
('leads', 'message (parsed)', 'Nome do formulário dentro da mensagem', 'empreendimento', 'pipeline_leads', 'extractCampanha() → normalizeEmpreendimento()', 'ok', NULL, 6),
('leads', 'message (parsed)', 'Nome da campanha completa', 'origem_detalhe', 'pipeline_leads', 'extractCampanha() direto', 'ok', NULL, 7),
('leads', 'source / origin / message', 'Canal de origem', 'origem', 'pipeline_leads', 'detectCanal() → Meta Ads / TikTok / Google / Portal / Site / Outro', 'ok', NULL, 8),
('leads', 'created_at', 'Data de criação no Jetimob', 'created_at', 'pipeline_leads', NULL, 'ok', 'Filtro CUTOFF: apenas >= 2026-03-07', 9),
('leads', 'campaign_id', 'ID da campanha no Jetimob', '(usado no jetimob_lead_id)', 'pipeline_leads', 'Parte do buildJetimobId()', 'ok', NULL, 10),
('leads', 'broker_id / responsavel_id', 'Responsável no Jetimob', '(não mapeado)', '—', NULL, 'warning', 'Usado apenas para filtro manual; a distribuição é feita pela roleta', 11),
('leads', 'cpf', 'CPF do lead', '(não mapeado)', '—', NULL, 'missing', 'Campo disponível na API mas não coletado', 12),
('leads', 'address', 'Endereço do lead', '(não mapeado)', '—', NULL, 'missing', 'Campo disponível mas não coletado', 13),
('leads', 'gender', 'Gênero', '(não mapeado)', '—', NULL, 'missing', 'Campo disponível mas não coletado', 14),
('leads', 'birthday', 'Data de nascimento', '(não mapeado)', '—', NULL, 'missing', 'Campo disponível mas não coletado', 15),
-- Imoveis mappings
('imoveis', 'codigo / referencia', 'Código de referência do imóvel', 'codigo (busca)', 'jetimob-proxy', 'isCodigoMatch() — normaliza e compara', 'ok', NULL, 1),
('imoveis', 'titulo / nome', 'Título do imóvel', 'titulo (exibição)', 'jetimob-proxy', NULL, 'ok', NULL, 2),
('imoveis', 'valor_venda / preco_venda', 'Valor de venda', 'valor (exibição)', 'jetimob-proxy', 'getPrice() — fallback para locação', 'ok', NULL, 3),
('imoveis', 'valor_locacao / preco_locacao', 'Valor de locação', 'valor (fallback)', 'jetimob-proxy', NULL, 'ok', NULL, 4),
('imoveis', 'dormitorios / quartos / suites', 'Número de dormitórios', 'dormitorios (filtro)', 'jetimob-proxy', 'getDorms()', 'ok', NULL, 5),
('imoveis', 'endereco_bairro / bairro', 'Bairro do imóvel', 'bairro (filtro)', 'jetimob-proxy', 'getBairro()', 'ok', NULL, 6),
('imoveis', 'subtipo / tipo_imovel / tipo', 'Tipo do imóvel', 'tipo (filtro)', 'jetimob-proxy', 'getTipo() — prefere subtipo', 'ok', NULL, 7),
('imoveis', 'fotos[] / imagens[]', 'Galeria de fotos', 'imagens (exibição)', 'jetimob-proxy', 'normalizeImages() — 9 campos + 10 sub-props', 'ok', NULL, 8),
('imoveis', 'area_total / area_privativa', 'Metragem', 'area (exibição)', 'jetimob-proxy', NULL, 'ok', NULL, 9),
('imoveis', 'descricao', 'Descrição completa', 'descricao (exibição)', 'jetimob-proxy', NULL, 'ok', NULL, 10),
('imoveis', 'situacao / status', 'Situação do imóvel', 'status (filtro)', 'jetimob-proxy', NULL, 'ok', NULL, 11),
('imoveis', 'plantas[]', 'Plantas do imóvel', '(não mapeado)', '—', NULL, 'missing', 'Campo disponível mas não exibido na UI', 12),
('imoveis', 'videos[]', 'Vídeos do imóvel', '(não mapeado)', '—', NULL, 'missing', 'Campo disponível mas não exibido na UI', 13),
('imoveis', 'caracteristicas[]', 'Características (piscina, churrasqueira...)', '(não mapeado)', '—', NULL, 'missing', 'Campo disponível mas não filtrado', 14);
