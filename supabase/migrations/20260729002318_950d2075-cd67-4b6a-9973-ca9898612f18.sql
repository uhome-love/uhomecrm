
-- =========================================================
-- Foco Corretores: resolver empreendimento_canonico_id no ingest,
-- corrigir conflito de alias e vincular campanhas ativas.
-- =========================================================

-- 1) RPC de resolução (ordem: form_id > form_name/formulario > campanha > empreendimento_texto)
CREATE OR REPLACE FUNCTION public.resolve_empreendimento_canonico(
  p_form_id text,
  p_form_name text,
  p_campanha text,
  p_empreendimento text
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. form_id exato (tipo 'formulario' via alias_raw match)
  IF p_form_id IS NOT NULL AND length(trim(p_form_id)) > 0 THEN
    SELECT empreendimento_id INTO v_id
    FROM empreendimento_aliases
    WHERE tipo = 'formulario' AND alias_raw = p_form_id
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  -- 2. form_name (normalizado, tipo 'formulario')
  IF p_form_name IS NOT NULL AND length(trim(p_form_name)) > 0 THEN
    SELECT empreendimento_id INTO v_id
    FROM empreendimento_aliases
    WHERE tipo = 'formulario' AND alias_norm = normalize_alias(p_form_name)
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  -- 3. campanha (normalizado)
  IF p_campanha IS NOT NULL AND length(trim(p_campanha)) > 0 THEN
    SELECT empreendimento_id INTO v_id
    FROM empreendimento_aliases
    WHERE tipo = 'campanha' AND alias_norm = normalize_alias(p_campanha)
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;

    -- fallback: campanha bate como texto de empreendimento
    SELECT empreendimento_id INTO v_id
    FROM empreendimento_aliases
    WHERE tipo = 'empreendimento_texto' AND alias_norm = normalize_alias(p_campanha)
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  -- 4. empreendimento texto (normalizado)
  IF p_empreendimento IS NOT NULL AND length(trim(p_empreendimento)) > 0 THEN
    SELECT empreendimento_id INTO v_id
    FROM empreendimento_aliases
    WHERE tipo = 'empreendimento_texto' AND alias_norm = normalize_alias(p_empreendimento)
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;

    -- ultimo recurso: nome canonico direto
    SELECT id INTO v_id
    FROM empreendimentos_canonicos
    WHERE normalize_alias(nome) = normalize_alias(p_empreendimento)
    LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_empreendimento_canonico(text,text,text,text) TO authenticated, service_role;

-- 2) Trigger BEFORE INSERT/UPDATE em pipeline_leads para preencher canonico quando NULL
CREATE OR REPLACE FUNCTION public.trg_resolve_empreendimento_canonico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NEW.empreendimento_canonico_id IS NULL THEN
    v_id := public.resolve_empreendimento_canonico(
      NEW.form_id,
      COALESCE(NEW.form_name, NEW.formulario),
      NEW.campanha,
      NEW.empreendimento
    );
    IF v_id IS NOT NULL THEN
      NEW.empreendimento_canonico_id := v_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_empreendimento_canonico ON public.pipeline_leads;
-- Precisa rodar ANTES do trg_auto_distribute_new_lead (que também é BEFORE INSERT).
-- Nome com prefixo "a_" garante ordem alfabética antes de "trg_auto_*".
CREATE TRIGGER a_resolve_empreendimento_canonico
BEFORE INSERT OR UPDATE ON public.pipeline_leads
FOR EACH ROW EXECUTE FUNCTION public.trg_resolve_empreendimento_canonico();

-- 3) Corrigir conflito: remover alias "The Arch" (tipo empreendimento_texto) apontando para AVULSO
DELETE FROM public.empreendimento_aliases
WHERE alias_norm = 'the arch'
  AND tipo = 'empreendimento_texto'
  AND empreendimento_id = '81384aae-325d-41ec-80d1-d8171a9e427c'; -- Avulso

-- Garantir alias correto "the arch" -> The Arch canonico (texto)
INSERT INTO public.empreendimento_aliases (alias_norm, alias_raw, empreendimento_id, tipo)
VALUES ('the arch', 'The Arch', '5dc1dfd4-0ac7-472d-a2b9-01dab53607d3', 'empreendimento_texto')
ON CONFLICT DO NOTHING;

-- 4) Aliases faltantes das campanhas ativas (form_id + textos observados nos últimos 30d)
-- The Arch: form_ids IG
INSERT INTO public.empreendimento_aliases (alias_norm, alias_raw, empreendimento_id, tipo) VALUES
  ('1920816755281750', '1920816755281750', '5dc1dfd4-0ac7-472d-a2b9-01dab53607d3', 'formulario'),
  ('915974148219092',  '915974148219092',  '5dc1dfd4-0ac7-472d-a2b9-01dab53607d3', 'formulario'),
  ('the arch - ig', 'The Arch - IG', '5dc1dfd4-0ac7-472d-a2b9-01dab53607d3', 'empreendimento_texto'),
  ('the arch - ig', 'The Arch - IG', '5dc1dfd4-0ac7-472d-a2b9-01dab53607d3', 'campanha')
ON CONFLICT DO NOTHING;

-- Connect JW: form_ids + textos
INSERT INTO public.empreendimento_aliases (alias_norm, alias_raw, empreendimento_id, tipo) VALUES
  ('1738640570794795', '1738640570794795', 'fa06971e-f446-42ed-9d39-1527f50d9c05', 'formulario'),
  ('2429450764205439', '2429450764205439', 'fa06971e-f446-42ed-9d39-1527f50d9c05', 'formulario'),
  ('2901048786909634', '2901048786909634', 'fa06971e-f446-42ed-9d39-1527f50d9c05', 'formulario'),
  ('connect jw - ig', 'Connect JW - IG', 'fa06971e-f446-42ed-9d39-1527f50d9c05', 'empreendimento_texto'),
  ('connect jw - ig', 'Connect JW - IG', 'fa06971e-f446-42ed-9d39-1527f50d9c05', 'campanha')
ON CONFLICT DO NOTHING;

-- Terrace v3
INSERT INTO public.empreendimento_aliases (alias_norm, alias_raw, empreendimento_id, tipo) VALUES
  ('1723035765368975', '1723035765368975', '3a177a9c-2323-44ed-a7bf-3304a1f363c3', 'formulario'),
  ('terrace v3', 'Terrace v3', '3a177a9c-2323-44ed-a7bf-3304a1f363c3', 'empreendimento_texto'),
  ('terrace v3', 'Terrace v3', '3a177a9c-2323-44ed-a7bf-3304a1f363c3', 'campanha')
ON CONFLICT DO NOTHING;

-- Casa Menino Deus (canonico existente)
INSERT INTO public.empreendimento_aliases (alias_norm, alias_raw, empreendimento_id, tipo) VALUES
  ('853814797808532', '853814797808532', '0fcb9384-a0dd-45c4-b035-24e896716a54', 'formulario'),
  ('casa menino deus - guto - qualificado', 'Casa Menino Deus - Guto — Qualificado', '0fcb9384-a0dd-45c4-b035-24e896716a54', 'campanha'),
  ('casa menino deus - guto - qualificado', 'Casa Menino Deus - Guto — Qualificado', '0fcb9384-a0dd-45c4-b035-24e896716a54', 'empreendimento_texto'),
  ('casa menino deus', 'Casa Menino Deus', '0fcb9384-a0dd-45c4-b035-24e896716a54', 'empreendimento_texto')
ON CONFLICT DO NOTHING;

-- Vértice Las Casas (variantes texto)
INSERT INTO public.empreendimento_aliases (alias_norm, alias_raw, empreendimento_id, tipo) VALUES
  ('las casas', 'Las casas', '14a40356-8ee0-4da1-8bf5-089f9b837597', 'empreendimento_texto'),
  ('vertice las casas', 'Vértice Las Casas', '14a40356-8ee0-4da1-8bf5-089f9b837597', 'empreendimento_texto')
ON CONFLICT DO NOTHING;

-- Grand Park Lindóia (canonico)
INSERT INTO public.empreendimento_aliases (alias_norm, alias_raw, empreendimento_id, tipo)
SELECT 'grand park lindoia', 'Grand Park Lindóia', id, 'empreendimento_texto'
FROM empreendimentos_canonicos WHERE nome ILIKE 'Grand Park Lindóia'
ON CONFLICT DO NOTHING;

-- Grand Park Moinhos (com trailing spaces observado no dado)
INSERT INTO public.empreendimento_aliases (alias_norm, alias_raw, empreendimento_id, tipo) VALUES
  ('grand park moinhos', 'Grand Park Moinhos', 'f0652eb8-57cb-47d1-8a7d-49fb669228bd', 'empreendimento_texto')
ON CONFLICT DO NOTHING;

-- Félix Moinhos e Open Major (canonicos existem)
INSERT INTO public.empreendimento_aliases (alias_norm, alias_raw, empreendimento_id, tipo) VALUES
  ('felix moinhos', 'Félix Moinhos', 'd9a7cf1a-406c-4526-9eb5-bf7c5a2228d8', 'empreendimento_texto'),
  ('open major', 'Open Major', '63085ca2-0a27-4046-8728-6f5c6ca08000', 'empreendimento_texto')
ON CONFLICT DO NOTHING;

-- 5) Backfill: força o trigger a resolver canonico nos leads dos últimos 60d
-- O trigger BEFORE UPDATE preencherá empreendimento_canonico_id quando NULL.
UPDATE public.pipeline_leads
SET updated_at = updated_at
WHERE empreendimento_canonico_id IS NULL
  AND created_at > now() - interval '60 days'
  AND (
    empreendimento IS NOT NULL
    OR campanha IS NOT NULL
    OR form_id IS NOT NULL
    OR form_name IS NOT NULL
  );
