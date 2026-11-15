CREATE OR REPLACE FUNCTION public.fn_url_param(_url text, _k text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE v text; b bytea := ''::bytea; i int := 1; c text;
BEGIN
  v := substring(_url from '[?&]' || _k || '=([^&#]*)');
  IF v IS NULL OR v = '' THEN RETURN NULL; END IF;
  v := replace(v, '+', ' ');
  WHILE i <= length(v) LOOP
    c := substr(v, i, 1);
    IF c = '%' AND substr(v, i+1, 2) ~ '^[0-9A-Fa-f]{2}$' THEN
      b := b || decode(substr(v, i+1, 2), 'hex'); i := i + 3;
    ELSE b := b || convert_to(c, 'UTF8'); i := i + 1; END IF;
  END LOOP;
  RETURN convert_from(b, 'UTF8');
EXCEPTION WHEN OTHERS THEN RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.fn_site_resumo(_dados jsonb, _obs text, _emp text, OUT onde text, OUT pagina text, OUT interesse text, OUT aparelho text, OUT fonte text)
LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE comp text; p text; t text; q text; src text; ref text; dev text; parts text[] := '{}';
BEGIN
  comp := coalesce(nullif(_dados->>'origem_componente',''), nullif(_dados->>'origem_detalhe',''));
  onde := CASE comp
    WHEN 'exit_intent' THEN 'Pop-up de saída' WHEN 'retargeting_popup' THEN 'Pop-up de retorno'
    WHEN 'floating_whatsapp' THEN 'Botão WhatsApp' WHEN 'header_cta' THEN 'Botão do topo'
    WHEN 'footer_cta' THEN 'Botão do rodapé' WHEN 'imovel_cta' THEN 'Formulário do imóvel'
    WHEN 'detalhe_sidebar' THEN 'Formulário do imóvel' WHEN 'detalhe_mobile_sticky' THEN 'Botão fixo do imóvel (celular)'
    WHEN 'hero_form' THEN 'Formulário da página inicial' WHEN 'contact_form' THEN 'Formulário de contato'
    ELSE coalesce(comp, substring(_obs from 'Origem:\s*([^\n|]+)')) END;
  pagina := coalesce(nullif(_dados->>'pagina_url',''), nullif(_dados->>'origem_pagina',''), trim(substring(_obs from 'Página:\s*([^\n| ]+)')));
  IF pagina ~ '/busca' THEN
    t := replace(replace(fn_url_param(pagina,'tipo'),'_',' '),',','/');
    IF t IS NOT NULL THEN parts := parts || t; END IF;
    IF fn_url_param(pagina,'quartos') IS NOT NULL THEN parts := parts || (fn_url_param(pagina,'quartos') || '+ quartos'); END IF;
    IF fn_url_param(pagina,'vagas') IS NOT NULL THEN parts := parts || (fn_url_param(pagina,'vagas') || '+ vaga(s)'); END IF;
    IF fn_url_param(pagina,'preco_max') ~ '^\d+$' THEN parts := parts || ('até R$ ' || round(fn_url_param(pagina,'preco_max')::numeric/1000) || ' mil'); END IF;
    q := coalesce(fn_url_param(pagina,'q'), fn_url_param(pagina,'bairro'));
    interesse := nullif(array_to_string(parts, ', ') || coalesce(' em ' || initcap(q), ''), '');
  END IF;
  IF interesse IS NULL AND _emp IS NOT NULL AND _emp !~* 'lead geral' THEN interesse := _emp; END IF;
  dev := lower(coalesce(_dados->>'device', substring(_obs from 'Device:\s*([^\n|]+)'), ''));
  aparelho := CASE WHEN dev LIKE '%mob%' THEN 'Celular' WHEN dev LIKE '%tab%' THEN 'Tablet' WHEN dev <> '' THEN 'Computador' END;
  src := lower(coalesce(_dados->>'utm_source', fn_url_param(pagina,'utm_source'), ''));
  ref := lower(coalesce(_dados->>'referrer', _dados->>'referer', ''));
  fonte := CASE
    WHEN coalesce(_dados->>'gclid',_dados->>'gbraid',_dados->>'wbraid',fn_url_param(pagina,'gclid')) IS NOT NULL THEN 'Google Ads'
    WHEN coalesce(_dados->>'fbclid',fn_url_param(pagina,'fbclid')) IS NOT NULL OR src ~ '(facebook|instagram|meta|^fb$|^ig$)' THEN 'Meta'
    WHEN src LIKE '%google%' AND lower(coalesce(_dados->>'utm_medium','')) ~ '(cpc|ppc|paid|ads)' THEN 'Google Ads'
    WHEN ref LIKE '%google.%' THEN 'Google orgânico'
    WHEN ref ~ '(bing\.|yahoo\.|duckduckgo\.)' THEN 'Outro buscador'
    WHEN ref ~ '(facebook\.|instagram\.)' THEN 'Meta'
    WHEN (ref <> '' AND ref NOT LIKE '%uhome.com.br%') OR src <> '' THEN 'Indicação/outro site'
    WHEN _dados ? 'referrer' THEN 'Direto'
    ELSE 'não informada pelo site' END;
  IF coalesce(_dados->>'utm_campaign','') <> '' THEN fonte := fonte || ' · ' || (_dados->>'utm_campaign'); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_site_registrar_historico(_lead_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l record; r record; txt text;
BEGIN
  SELECT * INTO l FROM pipeline_leads WHERE id = _lead_id;
  IF l.id IS NULL THEN RETURN; END IF;
  SELECT * INTO r FROM fn_site_resumo(coalesce(l.dados_site,'{}'::jsonb), l.observacoes, l.empreendimento);
  txt := concat_ws(E'\n',
    '📣 De onde veio: ' || r.fonte,
    '📍 Onde clicou: ' || coalesce(r.onde,'não informado pelo site'),
    '🌐 Página: ' || coalesce(r.pagina,'não informada pelo site'),
    CASE WHEN l.imovel_codigo IS NOT NULL OR l.imovel_url IS NOT NULL THEN '🏠 Imóvel: ' || coalesce(l.empreendimento,'') || coalesce(' (cód. ' || l.imovel_codigo || ')','') END,
    '🎯 Interesse: ' || coalesce(r.interesse,'não informado'),
    CASE WHEN r.aparelho IS NOT NULL THEN '📱 Aparelho: ' || r.aparelho END);
  INSERT INTO pipeline_atividades(pipeline_lead_id, tipo, titulo, descricao, status, created_by, data)
  VALUES (_lead_id, 'entrada', 'Lead gerado via Site — ' || coalesce(r.onde,'site'), txt, 'concluida',
          coalesce(l.corretor_id,'00000000-0000-0000-0000-000000000000'::uuid), (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date);
END $$;

CREATE OR REPLACE FUNCTION public.trg_site_interesse_bi()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r record;
BEGIN
  BEGIN
    IF NEW.origem = 'site_uhome' AND (NEW.empreendimento IS NULL OR NEW.empreendimento ~* 'lead geral') THEN
      SELECT * INTO r FROM fn_site_resumo(coalesce(NEW.dados_site,'{}'::jsonb), NEW.observacoes, NULL);
      IF r.interesse IS NOT NULL THEN NEW.empreendimento := 'Interesse declarado: ' || r.interesse; END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_site_historico_ai()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  BEGIN
    IF NEW.origem = 'site_uhome' THEN PERFORM fn_site_registrar_historico(NEW.id); END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_site_interesse_bi ON public.pipeline_leads;
CREATE TRIGGER trg_site_interesse_bi BEFORE INSERT ON public.pipeline_leads FOR EACH ROW EXECUTE FUNCTION public.trg_site_interesse_bi();
DROP TRIGGER IF EXISTS trg_site_historico_ai ON public.pipeline_leads;
CREATE TRIGGER trg_site_historico_ai AFTER INSERT ON public.pipeline_leads FOR EACH ROW EXECUTE FUNCTION public.trg_site_historico_ai();

REVOKE ALL ON FUNCTION public.fn_site_registrar_historico(uuid) FROM PUBLIC, anon, authenticated;