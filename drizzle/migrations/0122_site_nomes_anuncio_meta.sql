CREATE OR REPLACE FUNCTION public.site_nome_meta(p_id text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT CASE WHEN p_id ~ '^\d{9,}$' THEN coalesce(
    (SELECT max(campaign_name) FROM midia_criativos WHERE campaign_id=p_id),
    (SELECT max(ad_name) FROM midia_criativos WHERE ad_id=p_id),
    (SELECT max(adset_name) FROM midia_criativos WHERE adset_id=p_id),
    (SELECT max(campaign_name) FROM midia_snapshot_diario WHERE campaign_id=p_id),
    (SELECT max(ad_name) FROM midia_snapshot_diario WHERE ad_id=p_id),
    (SELECT max(adset_name) FROM midia_snapshot_diario WHERE adset_id=p_id)) END
$f$;
REVOKE ALL ON FUNCTION public.site_nome_meta(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_nome_meta(text) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.site_nomes_anuncio(p_ids text[]) RETURNS TABLE(id text, nome text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT i, public.site_nome_meta(i) FROM unnest(p_ids[1:10]) i WHERE auth.uid() IS NOT NULL AND public.site_nome_meta(i) IS NOT NULL
$f$;
REVOKE ALL ON FUNCTION public.site_nomes_anuncio(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_nomes_anuncio(text[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.fn_site_resumo(_dados jsonb, _obs text, _emp text, OUT onde text, OUT pagina text, OUT interesse text, OUT aparelho text, OUT fonte text)
 RETURNS record
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
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
    WHEN 'captacao_imovel' THEN 'Quer anunciar imóvel (proprietário)'
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
  IF fonte IS NOT NULL AND coalesce(_dados->>'utm_campaign','') <> '' THEN fonte := fonte || ' · ' || coalesce(public.site_nome_meta(_dados->>'utm_campaign'), CASE WHEN (_dados->>'utm_campaign') ~ '^\d{9,}$' THEN 'campanha do Meta' ELSE _dados->>'utm_campaign' END); END IF;
  fonte := coalesce(nullif(_dados->>'fonte',''), nullif(_dados#>>'{contexto,rastreamento,fonte}',''), fonte);
  IF fonte IS NOT NULL AND coalesce(_dados->>'utm_term', _dados#>>'{contexto,rastreamento,utm_term}','') <> '' AND coalesce(nullif(_dados->>'utm_term',''), _dados#>>'{contexto,rastreamento,utm_term}') !~ '^\d{6,}$' THEN
    fonte := fonte || ' · pesquisou "' || coalesce(nullif(_dados->>'utm_term',''), _dados#>>'{contexto,rastreamento,utm_term}') || '"';
  END IF;
  IF fonte IS NOT NULL AND coalesce(_dados#>>'{contexto,rastreamento,numero_visitas}', _dados->>'numero_visitas','') ~ '^\d+$' THEN
    fonte := fonte || ' · ' || coalesce(_dados#>>'{contexto,rastreamento,numero_visitas}', _dados->>'numero_visitas') || ' visita(s) ao site';
  END IF;
  fonte := coalesce(fonte, 'não informada pelo site');
END $function$;