
-- ============================================================
-- FASE 1: Empreendimentos Canônicos + Aliases + Trigger + Backfill
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ---------- 1. TABELAS ----------

CREATE TABLE IF NOT EXISTS public.empreendimentos_canonicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  segmento_id UUID NOT NULL REFERENCES public.roleta_segmentos(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empreendimentos_canonicos TO authenticated;
GRANT ALL ON public.empreendimentos_canonicos TO service_role;

ALTER TABLE public.empreendimentos_canonicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "canonicos_read_authenticated"
ON public.empreendimentos_canonicos FOR SELECT TO authenticated USING (true);

CREATE POLICY "canonicos_write_gestao"
ON public.empreendimentos_canonicos FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'gestor')
  OR public.has_role(auth.uid(),'diretor')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'gestor')
  OR public.has_role(auth.uid(),'diretor')
);

CREATE TABLE IF NOT EXISTS public.empreendimento_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_norm TEXT NOT NULL,
  alias_raw TEXT NOT NULL,
  empreendimento_id UUID NOT NULL REFERENCES public.empreendimentos_canonicos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('campanha','conjunto','anuncio','formulario','empreendimento_texto','origem_detalhe')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(alias_norm, tipo)
);

CREATE INDEX IF NOT EXISTS idx_alias_norm ON public.empreendimento_aliases(alias_norm);
CREATE INDEX IF NOT EXISTS idx_alias_emp ON public.empreendimento_aliases(empreendimento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empreendimento_aliases TO authenticated;
GRANT ALL ON public.empreendimento_aliases TO service_role;

ALTER TABLE public.empreendimento_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aliases_read_authenticated"
ON public.empreendimento_aliases FOR SELECT TO authenticated USING (true);

CREATE POLICY "aliases_write_gestao"
ON public.empreendimento_aliases FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'gestor')
  OR public.has_role(auth.uid(),'diretor')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'gestor')
  OR public.has_role(auth.uid(),'diretor')
);

-- ---------- 2. COLUNA em pipeline_leads ----------

ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS empreendimento_canonico_id UUID REFERENCES public.empreendimentos_canonicos(id);

CREATE INDEX IF NOT EXISTS idx_pl_emp_canonico ON public.pipeline_leads(empreendimento_canonico_id);

-- ---------- 3. FUNÇÕES ----------

-- Normaliza texto: lower + unaccent + trim + collapse spaces
CREATE OR REPLACE FUNCTION public.normalize_alias(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT NULLIF(regexp_replace(lower(unaccent(coalesce(input,''))), '\s+', ' ', 'g'), '')
$$;

-- Resolve empreendimento canônico a partir dos textos brutos do lead
CREATE OR REPLACE FUNCTION public.resolver_empreendimento_canonico(
  p_campanha TEXT,
  p_conjunto TEXT,
  p_anuncio TEXT,
  p_formulario TEXT,
  p_empreendimento TEXT,
  p_origem_detalhe TEXT
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Cascata: campanha → conjunto → anúncio → formulário → empreendimento_texto → origem_detalhe
  SELECT empreendimento_id INTO v_id
  FROM public.empreendimento_aliases
  WHERE alias_norm = public.normalize_alias(p_campanha) AND tipo='campanha'
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT empreendimento_id INTO v_id
  FROM public.empreendimento_aliases
  WHERE alias_norm = public.normalize_alias(p_conjunto) AND tipo='conjunto'
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT empreendimento_id INTO v_id
  FROM public.empreendimento_aliases
  WHERE alias_norm = public.normalize_alias(p_anuncio) AND tipo='anuncio'
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT empreendimento_id INTO v_id
  FROM public.empreendimento_aliases
  WHERE alias_norm = public.normalize_alias(p_formulario) AND tipo='formulario'
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT empreendimento_id INTO v_id
  FROM public.empreendimento_aliases
  WHERE alias_norm = public.normalize_alias(p_empreendimento) AND tipo='empreendimento_texto'
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT empreendimento_id INTO v_id
  FROM public.empreendimento_aliases
  WHERE alias_norm = public.normalize_alias(p_origem_detalhe) AND tipo='origem_detalhe'
  LIMIT 1;
  RETURN v_id;
END;
$$;

-- Trigger no pipeline_leads
CREATE OR REPLACE FUNCTION public.trg_pl_set_empreendimento_canonico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP='INSERT' OR
     NEW.campanha IS DISTINCT FROM OLD.campanha OR
     NEW.conjunto_anuncio IS DISTINCT FROM OLD.conjunto_anuncio OR
     NEW.anuncio IS DISTINCT FROM OLD.anuncio OR
     NEW.formulario IS DISTINCT FROM OLD.formulario OR
     NEW.empreendimento IS DISTINCT FROM OLD.empreendimento OR
     NEW.origem_detalhe IS DISTINCT FROM OLD.origem_detalhe
  THEN
    NEW.empreendimento_canonico_id := public.resolver_empreendimento_canonico(
      NEW.campanha, NEW.conjunto_anuncio, NEW.anuncio,
      NEW.formulario, NEW.empreendimento, NEW.origem_detalhe
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pl_empreendimento_canonico ON public.pipeline_leads;
CREATE TRIGGER trg_pl_empreendimento_canonico
BEFORE INSERT OR UPDATE OF campanha, conjunto_anuncio, anuncio, formulario, empreendimento, origem_detalhe
ON public.pipeline_leads
FOR EACH ROW EXECUTE FUNCTION public.trg_pl_set_empreendimento_canonico();

-- Trigger updated_at para canônicos
CREATE OR REPLACE FUNCTION public.trg_empreendimentos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_emp_canonicos_updated_at ON public.empreendimentos_canonicos;
CREATE TRIGGER trg_emp_canonicos_updated_at BEFORE UPDATE ON public.empreendimentos_canonicos
FOR EACH ROW EXECUTE FUNCTION public.trg_empreendimentos_updated_at();

-- ---------- 4. SEED CANÔNICOS ----------
-- Segmentos:
--   S1 Moradia      = 9948f523-29f4-46a7-bc1b-81ff8bb8dd50
--   S2 Investimento = 409aeddf-077f-473a-97cc-dfc0692ed35e
--   S3 Alto Padrão  = 5311aaaa-0000-4000-8000-000000000005
--   S4 MCMV         = 93ca556c-9a32-4fb8-b1af-148100ea47f0

INSERT INTO public.empreendimentos_canonicos (nome, segmento_id, ordem) VALUES
  ('Casa Tua',              '9948f523-29f4-46a7-bc1b-81ff8bb8dd50', 10),
  ('Open Bosque',           '9948f523-29f4-46a7-bc1b-81ff8bb8dd50', 20),
  ('Orygem',                '9948f523-29f4-46a7-bc1b-81ff8bb8dd50', 30),
  ('Shift',                 '9948f523-29f4-46a7-bc1b-81ff8bb8dd50', 40),
  ('Flow',                  '9948f523-29f4-46a7-bc1b-81ff8bb8dd50', 50),
  ('Vértice Las Casas',     '9948f523-29f4-46a7-bc1b-81ff8bb8dd50', 60),
  ('Alto Lindóia',          '9948f523-29f4-46a7-bc1b-81ff8bb8dd50', 70),
  ('Melnick Day',           '9948f523-29f4-46a7-bc1b-81ff8bb8dd50', 80),
  ('Boa Vista',             '9948f523-29f4-46a7-bc1b-81ff8bb8dd50', 90),
  ('Terrace',               '5311aaaa-0000-4000-8000-000000000005', 110),
  ('Vivid',                 '5311aaaa-0000-4000-8000-000000000005', 120),
  ('Vivid Terrace',         '5311aaaa-0000-4000-8000-000000000005', 125),
  ('Átrio',                 '5311aaaa-0000-4000-8000-000000000005', 130),
  ('Connect JW',            '5311aaaa-0000-4000-8000-000000000005', 140),
  ('Lake Baikal',           '5311aaaa-0000-4000-8000-000000000005', 150),
  ('Lake Eyre',             '5311aaaa-0000-4000-8000-000000000005', 160),
  ('Casa Bastian',          '5311aaaa-0000-4000-8000-000000000005', 170),
  ('High Garden Iguatemi',  '5311aaaa-0000-4000-8000-000000000005', 180),
  ('High Garden Rio Branco','5311aaaa-0000-4000-8000-000000000005', 185),
  ('Isla',                  '5311aaaa-0000-4000-8000-000000000005', 190),
  ('Seen Três Figueiras',   '5311aaaa-0000-4000-8000-000000000005', 200),
  ('Skyline Menino Deus',   '5311aaaa-0000-4000-8000-000000000005', 210),
  ('Casa Menino Deus',      '5311aaaa-0000-4000-8000-000000000005', 220),
  ('Vista Menino Deus',     '5311aaaa-0000-4000-8000-000000000005', 230),
  ('Vista Praia de Belas',  '5311aaaa-0000-4000-8000-000000000005', 240),
  ('Square Garden',         '5311aaaa-0000-4000-8000-000000000005', 250),
  ('Go Moinhos',            '5311aaaa-0000-4000-8000-000000000005', 260),
  ('Grand Park Moinhos',    '5311aaaa-0000-4000-8000-000000000005', 270),
  ('Duetto Morana',         '5311aaaa-0000-4000-8000-000000000005', 280),
  ('Castro700',             '5311aaaa-0000-4000-8000-000000000005', 290),
  ('Caiz',                  '5311aaaa-0000-4000-8000-000000000005', 300),
  ('Lév',                   '5311aaaa-0000-4000-8000-000000000005', 310),
  ('Demétrio ABF',          '5311aaaa-0000-4000-8000-000000000005', 320),
  ('Go Home Design',        '5311aaaa-0000-4000-8000-000000000005', 330),
  ('Vista Nova Carlos Gomes','5311aaaa-0000-4000-8000-000000000005', 340),
  ('Avulso',                '409aeddf-077f-473a-97cc-dfc0692ed35e', 900)
ON CONFLICT (nome) DO NOTHING;

-- ---------- 5. SEED ALIASES ----------
-- Helper: insere aliases (com normalização) para um empreendimento pelo nome.

WITH ids AS (SELECT id, nome FROM public.empreendimentos_canonicos)
INSERT INTO public.empreendimento_aliases (alias_norm, alias_raw, empreendimento_id, tipo)
SELECT public.normalize_alias(x.alias), x.alias, i.id, x.tipo
FROM (VALUES
  -- CASA TUA — 18 variantes observadas
  ('Casa Tua', 'empreendimento_texto', 'Casa Tua'),
  ('Casa Tua - Qualificado v2', 'empreendimento_texto', 'Casa Tua'),
  ('Casa Tua - Junho 2026', 'empreendimento_texto', 'Casa Tua'),
  ('Casa Tua - Uhome', 'empreendimento_texto', 'Casa Tua'),
  ('Lead Gerado do Formulário de Casa Tua (Video Gabriel 3D)', 'campanha', 'Casa Tua'),
  ('Lead Gerado do Formulário de Casa Tua (Video Gabriel 2D)', 'campanha', 'Casa Tua'),
  ('Lead Gerado do Formulário de Casa Tua (Tour Gabriel 3 Pessoa)', 'campanha', 'Casa Tua'),
  ('Lead Gerado do Formulário de Casa Tua (Cp Comparativo)', 'campanha', 'Casa Tua'),
  ('Lead Gerado do Formulário de Casa Tua (Cp investimento)', 'campanha', 'Casa Tua'),
  ('Lead Gerado do Formulário de Casa Tua', 'campanha', 'Casa Tua'),
  ('Casa Tua - Qualificado v2', 'campanha', 'Casa Tua'),
  ('Casa Tua - Junho 2026', 'campanha', 'Casa Tua'),
  ('Casa Tua - Abril 2026', 'campanha', 'Casa Tua'),
  ('Casa Tua - Uhome', 'campanha', 'Casa Tua'),
  ('Formulário Casa Tua (Meta Ads)', 'campanha', 'Casa Tua'),
  -- TERRACE
  ('Terrace', 'empreendimento_texto', 'Terrace'),
  ('Terrace - 2026', 'empreendimento_texto', 'Terrace'),
  ('Terrace v2 - Qualificado', 'empreendimento_texto', 'Terrace'),
  ('Terrace v2 - Qualificado', 'campanha', 'Terrace'),
  ('Terrace - 2026', 'campanha', 'Terrace'),
  -- VIVID / VIVID TERRACE
  ('Vivid - Qualificado - v2', 'empreendimento_texto', 'Vivid'),
  ('Vivid - Qualificado - v2', 'campanha', 'Vivid'),
  ('Vivid Terrace', 'empreendimento_texto', 'Vivid Terrace'),
  -- SHIFT
  ('Shift', 'empreendimento_texto', 'Shift'),
  ('Shift - Qualificado v7', 'empreendimento_texto', 'Shift'),
  ('Shift - 2026 - v5', 'empreendimento_texto', 'Shift'),
  ('Shift - Vanguard', 'empreendimento_texto', 'Shift'),
  ('Lead Gerado do Formulário de Shift (Video Gabriel)', 'campanha', 'Shift'),
  ('Lead Gerado do Formulário de Shift (Imagem)', 'campanha', 'Shift'),
  ('Shift - Qualificado v7', 'campanha', 'Shift'),
  ('Shift - 2026 - v5', 'campanha', 'Shift'),
  -- FLOW
  ('Flow', 'empreendimento_texto', 'Flow'),
  ('Flow - MGF - Qualificado', 'campanha', 'Flow'),
  -- ÁTRIO
  ('Átrio - ABF', 'empreendimento_texto', 'Átrio'),
  ('Átrio - Qualificado v3', 'empreendimento_texto', 'Átrio'),
  ('Átrio - Menino Deus - v2', 'empreendimento_texto', 'Átrio'),
  ('Lead Gerado do Formulário de Átrio (Imagem)', 'campanha', 'Átrio'),
  ('Átrio - Qualificado v3', 'campanha', 'Átrio'),
  ('Átrio - Menino Deus - v2', 'campanha', 'Átrio'),
  -- CONNECT JW
  ('Connect JW', 'empreendimento_texto', 'Connect JW'),
  ('Connect JW - Qualificado', 'empreendimento_texto', 'Connect JW'),
  ('Lead Gerado do Formulário de Connect JW (Video Tour)', 'campanha', 'Connect JW'),
  ('Connect JW - Qualificado', 'campanha', 'Connect JW'),
  -- LAKE BAIKAL / LAKE EYRE
  ('Lake Baikal', 'empreendimento_texto', 'Lake Baikal'),
  ('Lake Baikal - Novidade', 'campanha', 'Lake Baikal'),
  ('Lake Eyre', 'empreendimento_texto', 'Lake Eyre'),
  ('Lead Gerado do Formulário de Lake Eyre (1 Video - Lucas - Vista)', 'campanha', 'Lake Eyre'),
  ('Lead Gerado do Formulário de Lake Eyre (Imagem)', 'campanha', 'Lake Eyre'),
  -- OPEN BOSQUE / ORYGEM / VÉRTICE LAS CASAS / CASA BASTIAN
  ('Open Bosque', 'empreendimento_texto', 'Open Bosque'),
  ('Open Bosque - Uhome', 'empreendimento_texto', 'Open Bosque'),
  ('Lead Gerado do Formulário de Open Bosque (Video Lucas)', 'campanha', 'Open Bosque'),
  ('Lead Gerado do Formulário de Open Bosque (Anuncio Vídeo Gabrielle)', 'campanha', 'Open Bosque'),
  ('Open Bosque - Uhome', 'campanha', 'Open Bosque'),
  ('Orygem', 'empreendimento_texto', 'Orygem'),
  ('Lead Gerado do Formulário de Orygem (Vídeo Gabrielle)', 'campanha', 'Orygem'),
  ('Lead Gerado do Formulário de Orygem (Vídeo Lucas)', 'campanha', 'Orygem'),
  ('Las Casas', 'empreendimento_texto', 'Vértice Las Casas'),
  ('Vértice - Las Casas', 'empreendimento_texto', 'Vértice Las Casas'),
  ('Las Casas - Ápice', 'empreendimento_texto', 'Vértice Las Casas'),
  ('Lead Gerado do Formulário de Vértice - Bairro Las Casas (Video Gabrielle)', 'campanha', 'Vértice Las Casas'),
  ('Lead Gerado do Formulário de Vértice - Bairro Las Casas (Imagem)', 'campanha', 'Vértice Las Casas'),
  ('Las Casas - Ápice', 'campanha', 'Vértice Las Casas'),
  ('Casa Bastian', 'empreendimento_texto', 'Casa Bastian'),
  ('Lead Gerado do Formulário de Casa Bastian (Imagem)', 'campanha', 'Casa Bastian'),
  -- HIGH GARDEN
  ('High Garden Iguatemi', 'empreendimento_texto', 'High Garden Iguatemi'),
  ('Lead Gerado do Formulário do High Garden Iguatemi (Imagem)', 'campanha', 'High Garden Iguatemi'),
  ('Lead Gerado do Formulário do High Garden Iguatemi (Vídeo Gabriel)', 'campanha', 'High Garden Iguatemi'),
  ('Lead Gerado do Formulário do High Garden Iguatemi (Vídeo Gabrielle)', 'campanha', 'High Garden Iguatemi'),
  ('High Garden Rio Branco', 'empreendimento_texto', 'High Garden Rio Branco'),
  -- ISLA
  ('Isla', 'empreendimento_texto', 'Isla'),
  ('Lead Gerado do Formulário de Isla (Video CP))', 'campanha', 'Isla'),
  ('Lead Gerado do Formulário de Isla (Anuncio Vídeo Gabrielle)', 'campanha', 'Isla'),
  -- SEEN TRÊS FIGUEIRAS
  ('Seen Três Figueiras', 'empreendimento_texto', 'Seen Três Figueiras'),
  ('Lead Gerado do Formulário do Seen Três Figueiras (Imagem)', 'campanha', 'Seen Três Figueiras'),
  -- MENINO DEUS
  ('Skyline Menino Deus', 'empreendimento_texto', 'Skyline Menino Deus'),
  ('Lead Gerado do Formulário de Skyline Menino Deus', 'campanha', 'Skyline Menino Deus'),
  ('Casa Menino Deus - Guto', 'empreendimento_texto', 'Casa Menino Deus'),
  ('Casa Menino Deus - Guto', 'campanha', 'Casa Menino Deus'),
  ('Vista Menino Deus', 'empreendimento_texto', 'Vista Menino Deus'),
  -- MELNICK DAY
  ('Melnick Day', 'empreendimento_texto', 'Melnick Day'),
  ('Melnick Day 2026', 'empreendimento_texto', 'Melnick Day'),
  ('Melnick Day Compactos', 'empreendimento_texto', 'Melnick Day'),
  ('melnick_day_2026', 'campanha', 'Melnick Day'),
  ('melnick_day_poa_2026', 'campanha', 'Melnick Day'),
  ('Melnick Day - Landing Page', 'campanha', 'Melnick Day'),
  ('Lead Gerado do Formulário de Melnick Day Compactos (Video Gabriel)', 'campanha', 'Melnick Day'),
  -- ALTO LINDÓIA / VISTA / SQUARE / GO / DUETTO / CAIZ / DEMÉTRIO / LÉV
  ('Alto Lindóia', 'empreendimento_texto', 'Alto Lindóia'),
  ('Alto Lindoia', 'empreendimento_texto', 'Alto Lindóia'),
  ('Vista Praia de Belas', 'empreendimento_texto', 'Vista Praia de Belas'),
  ('Vista Nova Carlos Gomes', 'empreendimento_texto', 'Vista Nova Carlos Gomes'),
  ('Square Garden', 'empreendimento_texto', 'Square Garden'),
  ('Go Moinhos', 'empreendimento_texto', 'Go Moinhos'),
  ('Grand Park Moinhos', 'empreendimento_texto', 'Grand Park Moinhos'),
  ('Duetto - Morana', 'empreendimento_texto', 'Duetto Morana'),
  ('Castro700', 'empreendimento_texto', 'Castro700'),
  ('Caiz', 'empreendimento_texto', 'Caiz'),
  ('Caiz React', 'empreendimento_texto', 'Caiz'),
  ('Lév', 'empreendimento_texto', 'Lév'),
  ('Demétrio ABF', 'empreendimento_texto', 'Demétrio ABF'),
  ('Go Home Design', 'empreendimento_texto', 'Go Home Design'),
  -- BOA VISTA
  ('Boa Vista', 'empreendimento_texto', 'Boa Vista'),
  ('Boa Vista Country Club', 'empreendimento_texto', 'Boa Vista'),
  -- AVULSO (imovelweb, site, ImovelWeb)
  ('Avulso', 'empreendimento_texto', 'Avulso'),
  ('avulso', 'empreendimento_texto', 'Avulso'),
  ('Avulso - ImovelWeb', 'empreendimento_texto', 'Avulso'),
  ('ImovelWeb', 'campanha', 'Avulso')
) AS x(alias, tipo, canonico)
JOIN ids i ON i.nome = x.canonico
ON CONFLICT (alias_norm, tipo) DO NOTHING;

-- ---------- 6. BACKFILL 180d ----------
UPDATE public.pipeline_leads
SET empreendimento_canonico_id = public.resolver_empreendimento_canonico(
  campanha, conjunto_anuncio, anuncio, formulario, empreendimento, origem_detalhe
)
WHERE created_at > now() - interval '180 days'
  AND empreendimento_canonico_id IS NULL;
