ALTER TABLE public.pipeline_atividades ADD COLUMN IF NOT EXISTS site_pedido_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_atividades_site_pedido_unico ON public.pipeline_atividades(pipeline_lead_id,site_pedido_id) WHERE site_pedido_id IS NOT NULL;
COMMENT ON COLUMN public.pipeline_atividades.site_pedido_id IS 'Pedido do site: uma nota de sistema por lead e UUID, sem contar como contato humano.';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS dados_site jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.leads.is_teste IS 'Teste preservado e arquivado, excluído das apresentações e métricas.';
GRANT SELECT ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
CREATE OR REPLACE FUNCTION public.ler_dados_site_lead(p_lead_id uuid)
RETURNS TABLE(dados_site jsonb,observacoes text) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT p.dados_site,p.observacoes FROM public.pipeline_leads p WHERE p.id=p_lead_id
 UNION ALL
 SELECT l.dados_site,l.observacoes FROM public.leads l WHERE l.id=p_lead_id
   AND NOT EXISTS(SELECT 1 FROM public.pipeline_leads p WHERE p.id=p_lead_id)
 LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.ler_dados_site_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ler_dados_site_lead(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.site_pedido_texto(p jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE t text; d date; data_txt text; periodo text;
BEGIN
 t := CASE p->>'tipo' WHEN 'visita' THEN 'visita' WHEN 'informacoes' THEN 'informações' WHEN 'whatsapp' THEN 'WhatsApp' END;
 IF t IS NULL THEN RETURN NULL; END IF;
 periodo:=nullif(btrim(coalesce(p->>'periodo',p->>'período')),'');
 IF p->>'dia' ~ '^\d{4}-\d{2}-\d{2}$' THEN
   BEGIN
     d:=(p->>'dia')::date;
     data_txt:=(ARRAY['dom','seg','ter','qua','qui','sex','sáb'])[extract(dow from d)::integer+1] || ' ' || to_char(d,'DD/MM');
   EXCEPTION WHEN OTHERS THEN data_txt:=NULL; END;
 END IF;
 RETURN 'Pedido no site: ' || concat_ws(' · ',t,nullif(btrim(p->>'empreendimento'),''),
   CASE WHEN t='visita' THEN nullif(concat_ws(' ',data_txt,periodo,nullif(p->>'horario','')),'') ELSE nullif(btrim(p->>'assunto'),'') END,
   CASE WHEN nullif(btrim(p->>'planta'),'') IS NOT NULL THEN 'planta ' || (p->>'planta') END);
END $$;
REVOKE ALL ON FUNCTION public.site_pedido_texto(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.site_pedido_texto(jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.trg_site_pedidos_registrar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p jsonb; pid uuid; texto text; pagina text; momento timestamptz;
BEGIN
 FOR p IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.dados_site->'pedidos')='array' THEN NEW.dados_site->'pedidos' ELSE '[]'::jsonb END) LOOP
   BEGIN
     pid:=(p->>'id')::uuid;
     texto:=public.site_pedido_texto(p);
     IF pid IS NULL OR texto IS NULL THEN CONTINUE; END IF;
     pagina:=nullif(coalesce(p->>'pagina',p->>'página'),'');
     momento:=statement_timestamp();
     INSERT INTO public.pipeline_atividades(pipeline_lead_id,site_pedido_id,tipo,titulo,descricao,status,created_by,responsavel_id,data,hora,created_at)
     VALUES(NEW.id,pid,'sistema',texto,concat_ws(E'\n',texto,CASE WHEN pagina IS NOT NULL THEN 'Página: '||pagina END,
       CASE WHEN nullif(p->>'quando','') IS NOT NULL THEN 'Enviado em: '|| (p->>'quando') END),
       'concluida',coalesce(NEW.corretor_id,NEW.created_by,'00000000-0000-0000-0000-000000000000'::uuid),
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
REVOKE ALL ON FUNCTION public.trg_site_pedidos_registrar() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER site_pedidos_registrar AFTER INSERT OR UPDATE OF dados_site ON public.pipeline_leads FOR EACH ROW EXECUTE FUNCTION public.trg_site_pedidos_registrar();
CREATE OR REPLACE FUNCTION public.trg_site_voltou_aviso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_novo timestamptz; v_ant timestamptz; v_key text; v_pedido text; v_pid uuid;
BEGIN
 BEGIN
   IF NEW.corretor_id IS NULL OR NEW.dados_site IS NULL THEN RETURN NEW; END IF;
   SELECT a.titulo,a.site_pedido_id INTO v_pedido,v_pid FROM public.pipeline_atividades a
   WHERE a.pipeline_lead_id=NEW.id AND a.site_pedido_id IS NOT NULL AND a.created_at=statement_timestamp()
     AND a.created_at > NEW.created_at
   ORDER BY a.created_at DESC,a.id LIMIT 1;
   BEGIN v_novo:=public.site_evento_max(NEW.dados_site); v_ant:=public.site_evento_max(OLD.dados_site);
   EXCEPTION WHEN OTHERS THEN v_novo:=NULL; END;
   IF v_pedido IS NULL AND (v_novo IS NULL OR v_novo<=coalesce(v_ant,'-infinity') OR v_novo<=NEW.created_at) THEN RETURN NEW; END IF;
   v_key:='site_voltou:'||NEW.id||':';
   IF EXISTS(SELECT 1 FROM public.notifications WHERE agrupamento_key LIKE v_key||'%' AND created_at>now()-interval '1 hour') THEN RETURN NEW; END IF;
   PERFORM public.criar_notificacao(p_user_id=>NEW.corretor_id,p_tipo=>'leads',p_categoria=>'site_voltou',
     p_titulo=>CASE WHEN v_pedido IS NOT NULL THEN 'Novo pedido no site' ELSE 'Lead voltou ao site' END,
     p_mensagem=>coalesce(NEW.nome,'Seu lead') || CASE WHEN v_pedido IS NOT NULL THEN ' · '||v_pedido ELSE ' voltou ao site da Uhome. Veja a jornada na ficha.' END,
     p_dados=>jsonb_build_object('lead_id',NEW.id,'evento_em',v_novo,'pedido_id',v_pid),
     p_agrupamento_key=>v_key||to_char(now(),'YYYYMMDDHH24MI'));
 EXCEPTION WHEN OTHERS THEN
   BEGIN INSERT INTO public.ops_events(fn,level,category,message,ctx,error_detail)
     VALUES('trg_site_voltou_aviso','warn','site','Aviso do site não pôde ser criado',jsonb_build_object('lead_id',NEW.id),SQLSTATE);
   EXCEPTION WHEN OTHERS THEN NULL; END;
 END;
 RETURN NEW;
END $$;
DO $$
DECLARE definition text;
BEGIN
 definition:=rtrim(pg_get_viewdef('public.v_midia_lead_jornada'::regclass,true),E'\n ;');
 EXECUTE 'CREATE OR REPLACE VIEW public.v_midia_lead_jornada AS '||definition||' WHERE pl.is_teste = false';
END $$;