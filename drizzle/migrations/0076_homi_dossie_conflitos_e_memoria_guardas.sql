-- Hardening the approved Step 2; no source data or existing CRM health functions changed.
-- Rollback this guard: DROP TRIGGER homi_memoria_validar ON public.homi_memoria_lead;
-- DROP FUNCTION public.homi_memoria_validar(); restore dossier phone ambiguity expression below if explicitly authorized.
CREATE FUNCTION public.homi_memoria_validar() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.chave NOT IN ('decisor','objecao','prazo','orcamento','preferencia','observacao') OR NEW.chave IS NULL THEN RAISE EXCEPTION 'assunto inválido'; END IF;
 IF NEW.valor IS NULL OR length(trim(NEW.valor)) NOT BETWEEN 1 AND 400 THEN RAISE EXCEPTION 'fato inválido'; END IF;
 IF NEW.valor ~* '(telefone|celular|whatsapp|e-?mail|cpf|renda|sal[aá]rio|documento|rg\M|https?://|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|[0-9][0-9 .()+/-]{8,}[0-9])' THEN RAISE EXCEPTION 'dados pessoais não permitidos'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.homi_memoria_validar() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER homi_memoria_validar BEFORE INSERT OR UPDATE ON public.homi_memoria_lead FOR EACH ROW EXECUTE FUNCTION public.homi_memoria_validar();
-- Original ambiguity statement (for rollback) is the first literal passed to replace.
DO $$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef('public.homi_dossie_lead(uuid)'::regprocedure) INTO def;
 def:=replace(def,
 'SELECT count(*)>1 INTO amb FROM public.pipeline_leads WHERE NOT coalesce(arquivado,false) AND public.homi_normaliza_tel(telefone_normalizado)=tel;',
 'SELECT (SELECT count(*)>1 FROM public.pipeline_leads WHERE NOT coalesce(arquivado,false) AND public.homi_normaliza_tel(telefone_normalizado)=tel) OR EXISTS(SELECT 1 FROM public.lia_estado WHERE public.homi_normaliza_tel(telefone)=tel AND lead_id IS NOT NULL AND lead_id<>p_lead) INTO amb;');
 EXECUTE def;
END $$;