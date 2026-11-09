CREATE OR REPLACE FUNCTION public.bolsao_elegiveis(p_porta text)
RETURNS TABLE(lead_id uuid,empreendimento_label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
 WITH bloqueados AS MATERIALIZED (
  SELECT telefone_last8 AS chave FROM public.meta_supressao WHERE suprimir_ate IS NULL OR suprimir_ate>now()
  UNION SELECT telefone_key FROM public.base_leads WHERE opt_out
  UNION SELECT right(regexp_replace(telefone,'[^0-9]','','g'),8) FROM public.lia_estado WHERE optout OR status='ja_comprou'
  UNION SELECT telefone_last8 FROM public.ia_leads WHERE opt_out OR etapa_motivo='ja_comprou'
  UNION SELECT right(regexp_replace(telefone,'[^0-9]','','g'),8) FROM public.pipeline_leads WHERE motivo_descarte_code IN ('ja_comprou','comprou_outro','nao_quer_contato','lgpd')
 )
 SELECT pl.id,coalesce(ec.nome,nullif(trim(pl.empreendimento),''),'Sem empreendimento')
 FROM public.pipeline_leads pl JOIN public.pipeline_stages s ON s.id=pl.stage_id
 LEFT JOIN public.empreendimentos_canonicos ec ON ec.id=pl.empreendimento_canonico_id
 WHERE length(right(regexp_replace(coalesce(pl.telefone,''),'[^0-9]','','g'),8))=8
 AND NOT EXISTS(SELECT 1 FROM bloqueados b WHERE b.chave=right(regexp_replace(pl.telefone,'[^0-9]','','g'),8))
 AND pl.negocio_id IS NULL AND coalesce(pl.modulo_atual,'')<>'pos_vendas'
 AND NOT EXISTS(SELECT 1 FROM public.visitas v WHERE v.pipeline_lead_id=pl.id)
 AND NOT EXISTS(SELECT 1 FROM public.negocios n WHERE n.pipeline_lead_id=pl.id)
 AND NOT EXISTS(SELECT 1 FROM public.pipeline_parcerias pp WHERE pp.pipeline_lead_id=pl.id AND pp.status='ativa')
 AND coalesce(pl.reengajamento_status,'') NOT IN ('respondeu_nao','respondeu_nao_wave2','respondido_nao','telefone_invalido','bloqueado','respondeu_sim','respondeu_sim_wave2','respondido_sim')
 AND NOT EXISTS(SELECT 1 FROM public.reengajamento_dispatch_queue q WHERE q.lead_id=pl.id AND q.status IN ('pending','processing'))
 AND (pl.empreendimento_canonico_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.roleta_config rc WHERE rc.chave='fila_ceo_obrigatoria_canonicos' AND pl.empreendimento_canonico_id::text=ANY(string_to_array(replace(coalesce(rc.valor,''),' ',''),','))))
 AND NOT EXISTS(SELECT 1 FROM public.bolsao_reservas r WHERE r.pipeline_lead_id=pl.id AND ((r.reservado_ate>now() AND r.corretor_id IS DISTINCT FROM auth.uid()) OR r.cooldown_ate>now() OR r.ultimo_resultado IN ('sem_interesse')))
 AND ((p_porta='estagnados' AND pl.estagnado IS TRUE AND pl.estagnado_em<now()-interval '7 days' AND s.tipo NOT IN ('venda','caiu','descarte','convertido')) OR
 (p_porta='descartados' AND s.tipo='descarte' AND coalesce(pl.tipo_descarte,'reengajavel')='reengajavel' AND pl.stage_changed_at<now()-interval '7 days' AND pl.stage_changed_at>=now()-interval '180 days'));
$$;
COMMENT ON FUNCTION public.bolsao_elegiveis(text) IS 'Private SSOT eligibility. Global block keys are materialized once per query instead of thousands of repeated per-lead scans; original exclusions and reservation windows preserved.';