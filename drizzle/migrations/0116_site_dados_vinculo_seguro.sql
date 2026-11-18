ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS dados_site jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS site_pedido_notas jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.leads.site_pedido_notas IS 'Server-derived request notes keyed by request UUID, retained before a Pipeline card exists.';
CREATE OR REPLACE FUNCTION public.site_mesclar_dados(p_anterior jsonb,p_recebido jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE a jsonb; b jsonb; r jsonb; mapa jsonb:='{}'; p jsonb; k text; anterior jsonb; ultimo jsonb; instante timestamptz; maior timestamptz:='-infinity';
BEGIN
 a:=CASE WHEN jsonb_typeof(p_anterior)='object' THEN p_anterior ELSE '{}'::jsonb END;
 b:=CASE WHEN jsonb_typeof(p_recebido)='object' THEN p_recebido ELSE '{}'::jsonb END;
 r:=a||jsonb_strip_nulls(b);
 IF a->'primeira_origem' IS NOT NULL AND a->'primeira_origem'<>'null'::jsonb THEN r:=jsonb_set(r,'{primeira_origem}',a->'primeira_origem'); END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(
   (CASE WHEN jsonb_typeof(a->'pedidos')='array' THEN a->'pedidos' ELSE '[]'::jsonb END)||
   (CASE WHEN jsonb_typeof(b->'pedidos')='array' THEN b->'pedidos' ELSE '[]'::jsonb END)||
   (CASE WHEN jsonb_typeof(a->'pedido')='object' THEN jsonb_build_array(a->'pedido') ELSE '[]'::jsonb END)||
   (CASE WHEN jsonb_typeof(b->'pedido')='object' THEN jsonb_build_array(b->'pedido') ELSE '[]'::jsonb END)) LOOP
   IF jsonb_typeof(p)<>'object' OR coalesce(p->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN CONTINUE; END IF;
   k:=lower(p->>'id'); anterior:=coalesce(mapa->k,'{}'::jsonb);
   mapa:=jsonb_set(mapa,ARRAY[k],anterior||jsonb_strip_nulls(p)||jsonb_build_object('id',k));
 END LOOP;
 IF mapa<>'{}'::jsonb OR a ? 'pedidos' OR b ? 'pedidos' THEN
   r:=jsonb_set(r,'{pedidos}',coalesce((SELECT jsonb_agg(value ORDER BY value->>'horario',key) FROM jsonb_each(mapa)),'[]'::jsonb));
   FOR p IN SELECT value FROM jsonb_each(mapa) LOOP
     BEGIN instante:=(p->>'horario')::timestamptz; EXCEPTION WHEN OTHERS THEN instante:=NULL; END;
     IF ultimo IS NULL OR (instante IS NOT NULL AND instante>=maior) THEN ultimo:=p; maior:=coalesce(instante,maior); END IF;
   END LOOP;
   IF ultimo IS NOT NULL THEN r:=jsonb_set(r,'{pedido}',ultimo); END IF;
 END IF;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.site_mesclar_dados(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.site_mesclar_dados(jsonb,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.site_pedido_texto(p jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE t text; d date; data_txt text; periodo text;
BEGIN
 t:=CASE p->>'tipo' WHEN 'visita' THEN 'visita' WHEN 'informacoes' THEN 'informações' WHEN 'whatsapp' THEN 'WhatsApp' END;
 IF t IS NULL THEN RETURN NULL; END IF;
 periodo:=nullif(btrim(coalesce(p->>'periodo',p->>'período')),'');
 IF p->>'dia' ~ '^\d{4}-\d{2}-\d{2}$' THEN
   BEGIN d:=(p->>'dia')::date;
     data_txt:=(ARRAY['dom','seg','ter','qua','qui','sex','sáb'])[extract(dow from d)::integer+1]||' '||to_char(d,'DD/MM');
   EXCEPTION WHEN OTHERS THEN data_txt:=NULL; END;
 END IF;
 RETURN 'Pedido no site: '||concat_ws(' · ',t,nullif(btrim(p->>'empreendimento'),''),
   CASE WHEN t='visita' THEN nullif(concat_ws(' ',data_txt,periodo),'') ELSE nullif(btrim(p->>'assunto'),'') END,
   CASE WHEN nullif(btrim(p->>'planta'),'') IS NOT NULL THEN 'planta '||(p->>'planta') END);
END $$;
CREATE OR REPLACE FUNCTION public.site_pedido_descricao(p jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE momento timestamptz; enviado text; financiamento text;
BEGIN
 BEGIN momento:=(p->>'horario')::timestamptz;
   enviado:=to_char(momento AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI');
 EXCEPTION WHEN OTHERS THEN enviado:=NULL; END;
 financiamento:=CASE WHEN jsonb_typeof(p->'financiamento')='string' THEN nullif(p->>'financiamento','') ELSE NULL END;
 RETURN nullif(concat_ws(E'\n',CASE WHEN enviado IS NOT NULL THEN 'Pedido enviado em: '||enviado END,
   CASE WHEN financiamento IS NOT NULL THEN 'Financiamento: '||financiamento END,
   CASE WHEN nullif(coalesce(p->>'pagina',p->>'página'),'') IS NOT NULL THEN 'Página: '||coalesce(p->>'pagina',p->>'página') END),'');
END $$;
REVOKE ALL ON FUNCTION public.site_pedido_descricao(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.site_pedido_descricao(jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.trg_site_dados_guardar()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE antigo jsonb; notas jsonb; p jsonb; k text; texto text;
BEGIN
 antigo:=CASE WHEN TG_OP='UPDATE' THEN OLD.dados_site ELSE NULL END;
 IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
   IF NEW.dados_site IS DISTINCT FROM antigo OR (TG_TABLE_NAME='leads' AND ((TG_OP='UPDATE' AND to_jsonb(NEW)->'site_pedido_notas' IS DISTINCT FROM to_jsonb(OLD)->'site_pedido_notas') OR (TG_OP='INSERT' AND coalesce(to_jsonb(NEW)->'site_pedido_notas','{}'::jsonb)<>'{}'::jsonb))) THEN
     RAISE EXCEPTION 'Dados do site só podem ser gravados pela sincronização' USING ERRCODE='42501';
   END IF;
   IF TG_TABLE_NAME='leads' AND TG_OP='UPDATE' AND to_jsonb(NEW)->'pipeline_lead_id' IS DISTINCT FROM to_jsonb(OLD)->'pipeline_lead_id' THEN RAISE EXCEPTION 'Vínculo do site só pode ser gravado pela sincronização' USING ERRCODE='42501'; END IF;
   RETURN NEW;
 END IF;
 NEW.dados_site:=CASE WHEN NEW.dados_site IS NULL AND antigo IS NULL THEN NULL ELSE public.site_mesclar_dados(antigo,NEW.dados_site) END;
 IF TG_TABLE_NAME='leads' THEN
   notas:=CASE WHEN TG_OP='UPDATE' THEN coalesce(to_jsonb(OLD)->'site_pedido_notas','{}'::jsonb) ELSE '{}'::jsonb END;
   FOR p IN SELECT value FROM jsonb_array_elements(coalesce(NEW.dados_site->'pedidos','[]'::jsonb)) LOOP
     k:=p->>'id'; texto:=public.site_pedido_texto(p);
     IF texto IS NOT NULL AND NOT (notas ? k) THEN
       notas:=jsonb_set(notas,ARRAY[k],jsonb_build_object('id',k,'titulo',texto,'descricao',public.site_pedido_descricao(p),'horario',p->>'horario'));
     END IF;
   END LOOP;
   NEW:=jsonb_populate_record(NEW,jsonb_build_object('site_pedido_notas',notas));
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.trg_site_dados_guardar() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a00_site_dados_guardar BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.trg_site_dados_guardar();
CREATE TRIGGER a00_site_dados_guardar BEFORE INSERT OR UPDATE OF dados_site ON public.pipeline_leads FOR EACH ROW EXECUTE FUNCTION public.trg_site_dados_guardar();
CREATE OR REPLACE FUNCTION public.trg_site_dados_vincular()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.pipeline_lead_id IS NULL OR NEW.dados_site IS NULL THEN RETURN NEW; END IF;
 UPDATE public.pipeline_leads p SET dados_site=public.site_mesclar_dados(p.dados_site,NEW.dados_site)
 WHERE p.id=NEW.pipeline_lead_id AND p.dados_site IS DISTINCT FROM public.site_mesclar_dados(p.dados_site,NEW.dados_site);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.trg_site_dados_vincular() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER site_dados_vincular AFTER INSERT OR UPDATE OF dados_site,pipeline_lead_id ON public.leads FOR EACH ROW EXECUTE FUNCTION public.trg_site_dados_vincular();
CREATE OR REPLACE FUNCTION public.trg_site_pedidos_registrar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p jsonb; pid uuid; texto text; momento timestamptz;
BEGIN
 FOR p IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.dados_site->'pedidos')='array' THEN NEW.dados_site->'pedidos' ELSE '[]'::jsonb END) LOOP
   BEGIN
     pid:=(p->>'id')::uuid; texto:=public.site_pedido_texto(p);
     IF pid IS NULL OR texto IS NULL THEN CONTINUE; END IF;
     momento:=statement_timestamp();
     INSERT INTO public.pipeline_atividades(pipeline_lead_id,site_pedido_id,tipo,titulo,descricao,status,created_by,responsavel_id,data,hora,created_at)
     VALUES(NEW.id,pid,'sistema',texto,public.site_pedido_descricao(p),'concluida',coalesce(NEW.corretor_id,NEW.created_by,'00000000-0000-0000-0000-000000000000'::uuid),
       NEW.corretor_id,(momento AT TIME ZONE 'America/Sao_Paulo')::date,(momento AT TIME ZONE 'America/Sao_Paulo')::time,momento)
     ON CONFLICT(pipeline_lead_id,site_pedido_id) WHERE site_pedido_id IS NOT NULL DO NOTHING;
   EXCEPTION WHEN OTHERS THEN
     BEGIN INSERT INTO public.ops_events(fn,level,category,message,ctx,error_detail)
       VALUES('trg_site_pedidos_registrar','warn','site','Pedido do site não pôde gerar nota',jsonb_build_object('lead_id',NEW.id),SQLSTATE);
     EXCEPTION WHEN OTHERS THEN NULL; END;
   END;
 END LOOP;
 RETURN NEW;
END $$;
CREATE POLICY leads_select_linked_pipeline ON public.leads FOR SELECT TO authenticated
USING ((pipeline_lead_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.pipeline_leads p WHERE p.id=leads.pipeline_lead_id)) OR public.has_role(auth.uid(),'diretor'));
GRANT SELECT ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
CREATE OR REPLACE FUNCTION public.ler_dados_site_lead(p_lead_id uuid)
RETURNS TABLE(dados_site jsonb,observacoes text) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT p.dados_site,p.observacoes FROM public.pipeline_leads p WHERE p.id=p_lead_id
 UNION ALL
 SELECT (CASE WHEN l.dados_site IS NULL THEN '{}'::jsonb ELSE l.dados_site END)||jsonb_build_object('_pedidos_notas',l.site_pedido_notas),l.observacoes
 FROM public.leads l WHERE l.id=p_lead_id AND NOT EXISTS(SELECT 1 FROM public.pipeline_leads p WHERE p.id=p_lead_id)
 LIMIT 1
$$;
UPDATE public.leads SET dados_site=dados_site WHERE dados_site IS NOT NULL;
CREATE OR REPLACE FUNCTION public.sync_site_lead_to_pipeline()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
 v_stage_id uuid := 'd3843b2f-2fa1-4c31-9129-4eb0ed21f019'; v_pipeline_lead_id uuid; v_telefone_norm text; v_existing_id uuid; v_imovel_url text; v_empreendimento text; v_prop_title text;
BEGIN
 IF NEW.origem != 'site_uhome' OR NEW.is_teste THEN RETURN NEW; END IF;
 v_telefone_norm:=regexp_replace(NEW.telefone,'\D','','g');
 IF length(v_telefone_norm)>11 THEN v_telefone_norm:=right(v_telefone_norm,11); END IF;
 IF NEW.imovel_slug IS NOT NULL AND NEW.imovel_slug!='' THEN v_imovel_url:='https://uhomesales.com/imovel/'||NEW.imovel_slug; END IF;
 v_empreendimento:=NEW.imovel_interesse;
 IF NEW.imovel_codigo IS NOT NULL AND NEW.imovel_codigo!='' THEN
  SELECT titulo INTO v_prop_title FROM properties WHERE codigo=NEW.imovel_codigo LIMIT 1;
  IF v_prop_title IS NOT NULL THEN v_empreendimento:=v_prop_title; END IF;
 END IF;
 SELECT id INTO v_existing_id FROM pipeline_leads WHERE telefone_normalizado=v_telefone_norm LIMIT 1;
 IF v_existing_id IS NOT NULL THEN
  UPDATE pipeline_leads SET arquivado=false,stage_id=v_stage_id,stage_changed_at=now(),
   imovel_codigo=COALESCE(NEW.imovel_codigo,imovel_codigo),imovel_url=COALESCE(v_imovel_url,imovel_url),empreendimento=COALESCE(v_empreendimento,empreendimento),
   dados_site=public.site_mesclar_dados(dados_site,public.site_mesclar_dados(NEW.dados_site,jsonb_build_object('site_lead_id',NEW.site_lead_id,'imovel_interesse',NEW.imovel_interesse,'imovel_codigo',NEW.imovel_codigo,'imovel_slug',NEW.imovel_slug,'bairro_interesse',NEW.bairro_interesse,'origem_detalhe',NEW.origem_detalhe,'utm_source',NEW.utm_source,'utm_campaign',NEW.utm_campaign))),
   observacoes=COALESCE(observacoes,'')||E'\n---\n'||'[Site uhome.com.br] Reativado - '||COALESCE(v_empreendimento,'geral')||' ('||to_char(now(),'DD/MM/YYYY')||')',updated_at=now()
  WHERE id=v_existing_id;
  NEW.pipeline_lead_id:=v_existing_id; RETURN NEW;
 END IF;
 INSERT INTO pipeline_leads(nome,telefone,telefone_normalizado,email,origem,origem_detalhe,origem_ref,tipo_acao,dados_site,stage_id,stage_changed_at,empreendimento,imovel_codigo,imovel_url,observacoes,corretor_id,distribuido_em,aceite_status,aceito_em)
 VALUES(NEW.nome,NEW.telefone,v_telefone_norm,NEW.email,'site_uhome',COALESCE(NEW.origem_detalhe,'site_lead'),CASE WHEN NEW.atribuido_para IS NOT NULL THEN 'link_corretor' ELSE 'organico' END,'lead',
  public.site_mesclar_dados(NEW.dados_site,jsonb_build_object('site_lead_id',NEW.site_lead_id,'imovel_interesse',NEW.imovel_interesse,'imovel_codigo',NEW.imovel_codigo,'imovel_slug',NEW.imovel_slug,'bairro_interesse',NEW.bairro_interesse,'origem_detalhe',NEW.origem_detalhe,'utm_source',NEW.utm_source,'utm_campaign',NEW.utm_campaign)),
  v_stage_id,now(),v_empreendimento,NEW.imovel_codigo,v_imovel_url,'[Site uhome.com.br] '||COALESCE(v_empreendimento,'Lead geral'),NULL,NULL,'pendente_distribuicao',NULL)
 RETURNING id INTO v_pipeline_lead_id;
 NEW.pipeline_lead_id:=v_pipeline_lead_id; RETURN NEW;
END;
$function$;