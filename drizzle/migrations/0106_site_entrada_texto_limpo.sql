CREATE OR REPLACE FUNCTION public.fn_site_resumo(_dados jsonb, _obs text, _emp text, OUT onde text, OUT pagina text, OUT interesse text, OUT aparelho text, OUT fonte text)
 RETURNS record LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE comp text; t text; q text; src text; ref text; dev text; lp text; parts text[] := '{}';
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
  lp := coalesce(_dados->>'landing_url', '');
  fonte := CASE
    WHEN coalesce(_dados->>'gclid',_dados->>'gbraid',_dados->>'wbraid',fn_url_param(pagina,'gclid')) IS NOT NULL
      OR lp ~ '[?&](gclid|gbraid|wbraid|gad_source)=' THEN 'Google Ads'
    WHEN coalesce(_dados->>'fbclid',fn_url_param(pagina,'fbclid')) IS NOT NULL OR src ~ '(facebook|instagram|meta|^fb$|^ig$)' OR lp ~ '[?&]fbclid=' THEN 'Meta'
    WHEN src LIKE '%google%' AND lower(coalesce(_dados->>'utm_medium','')) ~ '(cpc|ppc|paid|ads)' THEN 'Google Ads'
    WHEN ref LIKE '%google.%' THEN 'Google orgânico'
    WHEN ref ~ '(bing\.|yahoo\.|duckduckgo\.)' THEN 'Outro buscador'
    WHEN ref ~ '(facebook\.|instagram\.)' THEN 'Meta'
    WHEN (ref <> '' AND ref NOT LIKE '%uhome.com.br%') OR src <> '' THEN 'Indicação/outro site'
    WHEN _dados ? 'referrer' THEN 'Direto'
    ELSE NULL END;
  IF fonte IS NOT NULL AND coalesce(_dados->>'utm_campaign','') <> '' THEN fonte := fonte || ' · ' || (_dados->>'utm_campaign'); END IF;
  fonte := coalesce(nullif(_dados->>'fonte',''), nullif(_dados#>>'{contexto,rastreamento,fonte}',''), fonte);
  IF fonte IS NOT NULL AND coalesce(_dados->>'utm_term', _dados#>>'{contexto,rastreamento,utm_term}','') <> '' THEN
    fonte := fonte || ' · pesquisou "' || coalesce(nullif(_dados->>'utm_term',''), _dados#>>'{contexto,rastreamento,utm_term}') || '"';
  END IF;
  IF fonte IS NOT NULL AND coalesce(_dados#>>'{contexto,rastreamento,numero_visitas}', _dados->>'numero_visitas','') ~ '^\d+$' THEN
    fonte := fonte || ' · ' || coalesce(_dados#>>'{contexto,rastreamento,numero_visitas}', _dados->>'numero_visitas') || ' visita(s) ao site';
  END IF;
  fonte := coalesce(fonte, 'não informada pelo site');
END $function$;

CREATE OR REPLACE FUNCTION public.fn_site_texto_entrada(_lead_id uuid, OUT titulo text, OUT descricao text)
 RETURNS record LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE l record; r record; imovel text; pag text;
BEGIN
  SELECT * INTO l FROM pipeline_leads WHERE id = _lead_id;
  IF l.id IS NULL THEN RETURN; END IF;
  SELECT * INTO r FROM fn_site_resumo(coalesce(l.dados_site,'{}'::jsonb), l.observacoes, l.empreendimento);
  titulo := 'Lead do site — ' || coalesce(r.onde, 'formulário do site');
  IF l.imovel_codigo IS NOT NULL OR l.imovel_url IS NOT NULL THEN
    imovel := regexp_replace(coalesce(l.empreendimento,''), '\s*\(' || coalesce(l.imovel_codigo,'§') || '\)\s*$', '');
    imovel := nullif(trim(imovel || coalesce(' (cód. ' || l.imovel_codigo || ')','')), '');
  END IF;
  pag := nullif(regexp_replace(regexp_replace(coalesce(r.pagina,''), '^https?://[^/]+', ''), '[#?].*$', ''), '');
  descricao := concat_ws(E'\n',
    CASE WHEN r.fonte <> 'não informada pelo site' THEN 'Origem: ' || r.fonte END,
    CASE WHEN imovel IS NOT NULL THEN 'Imóvel: ' || imovel END,
    CASE WHEN r.interesse IS NOT NULL AND (imovel IS NULL OR position(lower(regexp_replace(r.interesse,'\s*\(.*\)$','')) in lower(imovel)) = 0)
         THEN 'Interesse: ' || r.interesse END,
    CASE WHEN pag IS NOT NULL THEN 'Página: ' || pag END,
    CASE WHEN r.aparelho IS NOT NULL THEN 'Aparelho: ' || r.aparelho END);
END $function$;

CREATE OR REPLACE FUNCTION public.fn_site_registrar_historico(_lead_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE l record; x record;
BEGIN
  SELECT * INTO l FROM pipeline_leads WHERE id = _lead_id;
  IF l.id IS NULL THEN RETURN; END IF;
  SELECT * INTO x FROM fn_site_texto_entrada(_lead_id);
  INSERT INTO pipeline_atividades(pipeline_lead_id, tipo, titulo, descricao, status, created_by, data)
  VALUES (_lead_id, 'entrada', x.titulo, x.descricao, 'concluida',
          coalesce(l.corretor_id,'00000000-0000-0000-0000-000000000000'::uuid), (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date);
END $function$;

CREATE OR REPLACE FUNCTION public.trg_site_atualiza_entrada()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE x record;
BEGIN
  BEGIN
    SELECT * INTO x FROM fn_site_texto_entrada(NEW.id);
    UPDATE pipeline_atividades SET titulo = x.titulo, descricao = x.descricao
     WHERE pipeline_lead_id = NEW.id AND tipo = 'entrada'
       AND (titulo LIKE 'Lead gerado via Site%' OR titulo LIKE 'Lead do site —%')
       AND descricao IS DISTINCT FROM x.descricao;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS site_atualiza_entrada ON public.pipeline_leads;
CREATE TRIGGER site_atualiza_entrada AFTER UPDATE OF dados_site ON public.pipeline_leads
 FOR EACH ROW WHEN (OLD.dados_site IS DISTINCT FROM NEW.dados_site) EXECUTE FUNCTION public.trg_site_atualiza_entrada();