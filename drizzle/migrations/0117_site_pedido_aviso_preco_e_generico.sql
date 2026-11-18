CREATE OR REPLACE FUNCTION public.site_pedido_texto(p jsonb)
 RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $function$
DECLARE t text; d date; data_txt text; periodo text; n int; bruto text;
BEGIN
 bruto:=nullif(btrim(coalesce(p->>'tipo','')),'');
 IF bruto='aviso_preco' THEN
   n:=CASE WHEN jsonb_typeof(p->'imoveis')='array' THEN jsonb_array_length(p->'imoveis') ELSE 0 END;
   RETURN 'Pedido no site: aviso de preço'||CASE WHEN n>0 THEN ' · '||n||CASE WHEN n=1 THEN ' imóvel salvo' ELSE ' imóveis salvos' END ELSE '' END;
 END IF;
 t:=CASE bruto WHEN 'visita' THEN 'visita' WHEN 'informacoes' THEN 'informações' WHEN 'whatsapp' THEN 'WhatsApp' END;
 IF t IS NULL THEN RETURN 'Pedido no site: '||coalesce(bruto,'sem tipo'); END IF;
 periodo:=nullif(btrim(coalesce(p->>'periodo',p->>'período')),'');
 IF p->>'dia' ~ '^\d{4}-\d{2}-\d{2}$' THEN
   BEGIN d:=(p->>'dia')::date;
     data_txt:=(ARRAY['dom','seg','ter','qua','qui','sex','sáb'])[extract(dow from d)::integer+1]||' '||to_char(d,'DD/MM');
   EXCEPTION WHEN OTHERS THEN data_txt:=NULL; END;
 END IF;
 RETURN 'Pedido no site: '||concat_ws(' · ',t,nullif(btrim(p->>'empreendimento'),''),
   CASE WHEN t='visita' THEN nullif(concat_ws(' ',data_txt,periodo),'') ELSE nullif(btrim(p->>'assunto'),'') END,
   CASE WHEN nullif(btrim(p->>'planta'),'') IS NOT NULL THEN 'planta '||(p->>'planta') END);
END $function$;

CREATE OR REPLACE FUNCTION public.site_pedido_descricao(p jsonb)
 RETURNS text LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE momento timestamptz; enviado text; financiamento text; lista text; item text; linha text; pr record;
BEGIN
 BEGIN momento:=(p->>'horario')::timestamptz;
   enviado:=to_char(momento AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI');
 EXCEPTION WHEN OTHERS THEN enviado:=NULL; END;
 financiamento:=CASE WHEN jsonb_typeof(p->'financiamento')='string' THEN nullif(p->>'financiamento','') ELSE NULL END;
 IF jsonb_typeof(p->'imoveis')='array' THEN
   FOR item IN SELECT value FROM jsonb_array_elements_text(p->'imoveis') LOOP
     pr:=NULL;
     BEGIN SELECT codigo,bairro,valor_venda INTO pr FROM public.properties WHERE id=item::uuid;
     EXCEPTION WHEN OTHERS THEN pr:=NULL; END;
     IF pr IS NOT NULL AND (pr.codigo IS NOT NULL OR pr.bairro IS NOT NULL OR pr.valor_venda IS NOT NULL) THEN
       linha:=concat_ws(' · ',coalesce(nullif(pr.codigo,''),item),nullif(pr.bairro,''),
         CASE WHEN pr.valor_venda IS NOT NULL THEN 'R$ '||replace(to_char(pr.valor_venda,'FM999G999G999G990'),',','.') END);
     ELSE linha:=item; END IF;
     lista:=concat_ws(E'\n',lista,'- '||linha);
   END LOOP;
 END IF;
 RETURN nullif(concat_ws(E'\n',CASE WHEN enviado IS NOT NULL THEN 'Pedido enviado em: '||enviado END,
   CASE WHEN financiamento IS NOT NULL THEN 'Financiamento: '||financiamento END,
   CASE WHEN lista IS NOT NULL THEN 'Imóveis salvos:'||E'\n'||lista END,
   CASE WHEN nullif(coalesce(p->>'pagina',p->>'página'),'') IS NOT NULL THEN 'Página: '||coalesce(p->>'pagina',p->>'página') END),'');
END $function$;