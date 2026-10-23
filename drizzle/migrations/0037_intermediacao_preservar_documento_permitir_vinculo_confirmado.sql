CREATE OR REPLACE FUNCTION public.intermediacao_edicao_preservar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF to_jsonb(NEW)-ARRAY['negocio_id','pipeline_lead_id','updated_at'] IS NOT DISTINCT FROM to_jsonb(OLD)-ARRAY['negocio_id','pipeline_lead_id','updated_at'] AND OLD.negocio_id IS NULL AND NEW.negocio_id IS NOT NULL AND (OLD.pipeline_lead_id IS NULL OR OLD.pipeline_lead_id=NEW.pipeline_lead_id) AND EXISTS(SELECT 1 FROM public.negocios n WHERE n.id=NEW.negocio_id AND n.pipeline_lead_id=NEW.pipeline_lead_id AND n.status='ativo' AND (n.fase<>'ganho' OR n.intermediacao_id IS NULL) AND public.resolver_empreendimento_canonico(NULL,NULL,NULL,NULL,OLD.empreendimento,NULL)=n.empreendimento_canonico_id AND btrim(OLD.unidade)=btrim(n.unidade) AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.can_access_lead(n.pipeline_lead_id))) THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.negocios WHERE intermediacao_id=OLD.id AND fase='ganho') OR OLD.origem='drive_historico' OR EXISTS(SELECT 1 FROM public.negocios_recebimentos WHERE intermediacao_id=OLD.id AND status='recebido') THEN
  IF to_jsonb(NEW)-'updated_at' IS DISTINCT FROM to_jsonb(OLD)-'updated_at' THEN RAISE EXCEPTION 'Preserve a intermediação assinada, histórica ou recebida.'; END IF;
 ELSE
  IF to_jsonb(NEW)-ARRAY['status','updated_at'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['status','updated_at'] THEN RAISE EXCEPTION 'Gere uma nova versão completa para alterar a intermediação.'; END IF;
 END IF; RETURN NEW;
END $$;