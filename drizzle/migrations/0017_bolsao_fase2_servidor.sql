ALTER TABLE public.pipeline_leads ADD COLUMN IF NOT EXISTS reaproveitado_em timestamptz;

CREATE TABLE public.bolsao_reservas (
  pipeline_lead_id uuid PRIMARY KEY,
  corretor_id uuid,
  porta text NOT NULL DEFAULT 'estagnados',
  reservado_ate timestamptz,
  cooldown_ate timestamptz,
  ultimo_resultado text,
  tentativas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bolsao_reservas TO authenticated;
GRANT ALL ON public.bolsao_reservas TO service_role;
ALTER TABLE public.bolsao_reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Corretor vê as próprias reservas" ON public.bolsao_reservas FOR SELECT TO authenticated
  USING (corretor_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

-- Elegíveis (sem checagem de telefone duplicado, feita no puxar)
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
    AND NOT EXISTS (SELECT 1 FROM reengajamento_dispatch_queue q WHERE q.lead_id = pl.id AND q.status NOT IN ('sent','failed','suppressed','skipped','cancelled'))
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
REVOKE ALL ON FUNCTION public.bolsao_elegiveis(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bolsao_contagens(p_porta text)
RETURNS TABLE(empreendimento text, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT e.empreendimento_label, count(*) FROM public.bolsao_elegiveis(p_porta) e
  WHERE auth.uid() IS NOT NULL
  GROUP BY 1 ORDER BY 2 DESC;
$$;
GRANT EXECUTE ON FUNCTION public.bolsao_contagens(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bolsao_puxar(p_porta text, p_empreendimentos text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_lead record;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','nao_autenticado'); END IF;
  IF p_porta NOT IN ('estagnados','descartados') THEN RETURN jsonb_build_object('ok',false,'error','porta_invalida'); END IF;

  -- libera reserva anterior do próprio corretor
  UPDATE bolsao_reservas SET reservado_ate = NULL, updated_at = now()
   WHERE corretor_id = v_uid AND reservado_ate > now();

  SELECT pl.id, pl.nome, pl.telefone, pl.origem, pl.created_at, e.empreendimento_label
    INTO v_lead
  FROM public.bolsao_elegiveis(p_porta) e
  JOIN pipeline_leads pl ON pl.id = e.lead_id
  WHERE (p_empreendimentos IS NULL OR cardinality(p_empreendimentos) = 0 OR e.empreendimento_label = ANY(p_empreendimentos))
    AND (pl.telefone_normalizado IS NULL OR NOT EXISTS (
         SELECT 1 FROM pipeline_leads d JOIN pipeline_stages ds ON ds.id = d.stage_id
          WHERE d.telefone_normalizado = pl.telefone_normalizado AND d.id <> pl.id
            AND COALESCE(d.arquivado,false) = false AND ds.tipo <> 'descarte'
            AND COALESCE(d.estagnado,false) = false))
  ORDER BY random()
  LIMIT 1
  FOR UPDATE OF pl SKIP LOCKED;

  IF v_lead IS NULL THEN RETURN jsonb_build_object('ok',true,'lead',NULL); END IF;

  INSERT INTO bolsao_reservas (pipeline_lead_id, corretor_id, porta, reservado_ate, updated_at)
  VALUES (v_lead.id, v_uid, p_porta, now() + interval '5 minutes', now())
  ON CONFLICT (pipeline_lead_id) DO UPDATE SET corretor_id = EXCLUDED.corretor_id, porta = EXCLUDED.porta,
    reservado_ate = EXCLUDED.reservado_ate, updated_at = now();

  RETURN jsonb_build_object('ok',true,'lead', jsonb_build_object(
    'id', v_lead.id, 'nome', v_lead.nome, 'telefone', v_lead.telefone, 'origem', v_lead.origem,
    'entrou_em', v_lead.created_at, 'empreendimento', v_lead.empreendimento_label,
    'reservado_ate', now() + interval '5 minutes'));
END $$;
GRANT EXECUTE ON FUNCTION public.bolsao_puxar(text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.bolsao_registrar(p_lead_id uuid, p_resultado text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_res bolsao_reservas; v_descarte uuid;
BEGIN
  SELECT * INTO v_res FROM bolsao_reservas WHERE pipeline_lead_id = p_lead_id FOR UPDATE;
  IF v_res IS NULL OR v_res.corretor_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok',false,'error','reserva_nao_encontrada');
  END IF;

  IF p_resultado = 'liberar' THEN
    UPDATE bolsao_reservas SET reservado_ate = NULL, updated_at = now() WHERE pipeline_lead_id = p_lead_id;
  ELSIF p_resultado = 'nao_atendeu' THEN
    UPDATE bolsao_reservas SET reservado_ate = NULL, cooldown_ate = now() + interval '24 hours',
      ultimo_resultado = 'nao_atendeu', tentativas = tentativas + 1, updated_at = now() WHERE pipeline_lead_id = p_lead_id;
  ELSIF p_resultado = 'sem_interesse' THEN
    SELECT id INTO v_descarte FROM pipeline_stages WHERE tipo = 'descarte' AND pipeline_tipo = 'leads' ORDER BY ordem LIMIT 1;
    UPDATE pipeline_leads SET stage_id = COALESCE(v_descarte, stage_id), stage_changed_at = now(),
      tipo_descarte = 'definitivo', motivo_descarte = 'Sem interesse (Bolsão)', arquivado = true,
      estagnado = false, updated_at = now()
     WHERE id = p_lead_id;
    UPDATE bolsao_reservas SET reservado_ate = NULL, ultimo_resultado = 'sem_interesse',
      tentativas = tentativas + 1, updated_at = now() WHERE pipeline_lead_id = p_lead_id;
  ELSE
    RETURN jsonb_build_object('ok',false,'error','resultado_invalido');
  END IF;
  RETURN jsonb_build_object('ok',true);
END $$;
GRANT EXECUTE ON FUNCTION public.bolsao_registrar(uuid, text) TO authenticated;