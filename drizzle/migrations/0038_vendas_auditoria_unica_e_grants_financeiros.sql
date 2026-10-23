REVOKE INSERT,UPDATE,DELETE ON public.financeiro_historico,public.financeiro_repasses FROM authenticated,anon;
CREATE OR REPLACE FUNCTION public.financeiro_auditar_venda() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.fase='ganho' AND (NEW.vgv_final IS DISTINCT FROM OLD.vgv_final OR NEW.unidade IS DISTINCT FROM OLD.unidade OR NEW.data_assinatura IS DISTINCT FROM OLD.data_assinatura)
 AND NOT EXISTS (SELECT 1 FROM public.financeiro_historico h WHERE h.entidade='negocios' AND h.entidade_id=NEW.id AND h.acao='edicao_venda' AND h.user_id IS NOT DISTINCT FROM auth.uid() AND h.transacao=txid_current()) THEN
 INSERT INTO public.financeiro_historico(entidade,entidade_id,acao,user_id,antes,depois) VALUES('negocios',NEW.id,'edicao_venda',auth.uid(),to_jsonb(OLD),to_jsonb(NEW));
 END IF;
 RETURN NEW;
END $$;