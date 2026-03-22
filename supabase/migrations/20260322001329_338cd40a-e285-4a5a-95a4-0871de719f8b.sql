
-- PERFIL DE INTERESSE
CREATE TABLE IF NOT EXISTS public.perfil_interesse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo_imovel text,
  bairros text[] DEFAULT '{}',
  preco_min numeric,
  preco_max numeric,
  quartos_min integer,
  diferenciais text[] DEFAULT '{}',
  query_ia text,
  alerta_ativo boolean DEFAULT true,
  UNIQUE(lead_id)
);

CREATE INDEX IF NOT EXISTS idx_perfil_interesse_lead ON public.perfil_interesse(lead_id);

-- IMÓVEIS DE INTERESSE
CREATE TABLE IF NOT EXISTS public.imoveis_interesse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  imovel_id_site text NOT NULL,
  imovel_titulo text,
  imovel_bairro text,
  imovel_preco numeric,
  favoritado_em timestamptz,
  UNIQUE(lead_id, imovel_id_site)
);

CREATE INDEX IF NOT EXISTS idx_imoveis_interesse_lead ON public.imoveis_interesse(lead_id);
