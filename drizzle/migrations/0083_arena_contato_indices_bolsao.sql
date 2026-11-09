CREATE INDEX IF NOT EXISTS idx_lia_estado_bloqueio_tel8 ON public.lia_estado ((right(regexp_replace(telefone,'[^0-9]','','g'),8))) WHERE optout OR status='ja_comprou';
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_bloqueio_tel8 ON public.pipeline_leads ((right(regexp_replace(telefone,'[^0-9]','','g'),8))) WHERE motivo_descarte_code IN ('ja_comprou','comprou_outro','nao_quer_contato','lgpd');
CREATE OR REPLACE FUNCTION public.contato_bloqueado(p_telefone text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
 SELECT length(right(regexp_replace(coalesce(p_telefone,''),'[^0-9]','','g'),8))<>8 OR
 EXISTS(SELECT 1 FROM public.meta_supressao s WHERE s.telefone_last8=right(regexp_replace(p_telefone,'[^0-9]','','g'),8) AND (s.suprimir_ate IS NULL OR s.suprimir_ate>now())) OR
 EXISTS(SELECT 1 FROM public.base_leads b WHERE b.telefone_key=right(regexp_replace(p_telefone,'[^0-9]','','g'),8) AND b.opt_out) OR
 EXISTS(SELECT 1 FROM public.lia_estado e WHERE right(regexp_replace(e.telefone,'[^0-9]','','g'),8)=right(regexp_replace(p_telefone,'[^0-9]','','g'),8) AND (e.optout OR e.status='ja_comprou')) OR
 EXISTS(SELECT 1 FROM public.ia_leads i WHERE i.telefone_last8=right(regexp_replace(p_telefone,'[^0-9]','','g'),8) AND (i.opt_out OR i.etapa_motivo='ja_comprou')) OR
 EXISTS(SELECT 1 FROM public.pipeline_leads p WHERE right(regexp_replace(p.telefone,'[^0-9]','','g'),8)=right(regexp_replace(p_telefone,'[^0-9]','','g'),8) AND p.motivo_descarte_code IN ('ja_comprou','comprou_outro','nao_quer_contato','lgpd'));
$$;
COMMENT ON INDEX public.idx_lia_estado_bloqueio_tel8 IS 'Speeds global opt-out checks in Arena/Bolsao without changing contact eligibility.';
COMMENT ON INDEX public.idx_pipeline_leads_bloqueio_tel8 IS 'Speeds purchase/opt-out checks by normalized last eight digits, preserving existing global contact rule.';