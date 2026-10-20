CREATE INDEX IF NOT EXISTS idx_reeng_queue_lead_pendente ON public.reengajamento_dispatch_queue (lead_id) WHERE status IN ('pending','processing');
CREATE OR REPLACE FUNCTION public.bolsao_elegiveis(p_porta text)
RETURNS TABLE(lead_id uuid, empreendimento_label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT pl.id, COALESCE(ec.nome, NULLIF(trim(pl.empreendimento),''), 'Sem empreendimento')
  FROM pipeline_leads pl
  JOIN pipeline_stages s ON s.id = pl.stage_id
  LEFT JOIN empreendimentos_canonicos ec ON ec.id = pl.empreendimento_canonico_id
  WHERE pl.negocio_id IS NULL
    AND COALESCE(pl.modulo_atual,'') <> 'pos_vendas'
    AND NOT EXISTS (SELECT 1 FROM visitas v WHERE v.pipeline_lead_id = pl.id)
    AND NOT EXISTS (SELECT 1 FROM negocios n WHERE n.pipeline_lead_id = pl.id)
    AND NOT EXISTS (SELECT 1 FROM pipeline_parcerias pp WHERE pp.pipeline_lead_id = pl.id AND pp.status='ativa')
    AND COALESCE(pl.reengajamento_status,'') NOT IN ('respondeu_nao','respondeu_nao_wave2','respondido_nao','telefone_invalido','bloqueado','respondeu_sim','respondeu_sim_wave2','respondido_sim')
    AND NOT EXISTS (SELECT 1 FROM reengajamento_dispatch_queue q WHERE q.lead_id = pl.id AND q.status IN ('pending','processing'))
    AND (pl.empreendimento_canonico_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM roleta_config rc WHERE rc.chave='fila_ceo_obrigatoria_canonicos'
            AND pl.empreendimento_canonico_id::text = ANY(string_to_array(replace(COALESCE(rc.valor,''),' ',''), ','))))
    AND NOT EXISTS (SELECT 1 FROM bolsao_reservas r WHERE r.pipeline_lead_id = pl.id
          AND ((r.reservado_ate > now() AND r.corretor_id IS DISTINCT FROM auth.uid()) OR r.cooldown_ate > now() OR r.ultimo_resultado IN ('sem_interesse')))
    AND (
      (p_porta = 'estagnados' AND pl.estagnado IS TRUE AND pl.estagnado_em < now() - interval '7 days'
        AND s.tipo NOT IN ('venda','caiu','descarte','convertido'))
      OR
      (p_porta = 'descartados' AND s.tipo = 'descarte' AND COALESCE(pl.tipo_descarte,'reengajavel') = 'reengajavel'
        AND pl.stage_changed_at < now() - interval '7 days' AND pl.stage_changed_at >= now() - interval '180 days')
    );
$$;