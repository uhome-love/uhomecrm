CREATE OR REPLACE FUNCTION public.lead_livre_para_repasse(p_lead_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM pipeline_leads l
    LEFT JOIN pipeline_stages s ON s.id = l.stage_id
    LEFT JOIN profiles p ON p.user_id = l.corretor_id
    WHERE l.id = p_lead_id AND (
      COALESCE(l.arquivado,false) OR s.tipo = 'descarte' OR l.corretor_id IS NULL OR p.user_id IS NULL OR COALESCE(p.ativo,true) = false
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.buscar_leads_repasse_gestor(
  p_nome text DEFAULT NULL, p_telefone text DEFAULT NULL, p_email text DEFAULT NULL,
  p_empreendimento text DEFAULT NULL, p_origem text DEFAULT NULL,
  p_data_inicio timestamptz DEFAULT NULL, p_data_fim timestamptz DEFAULT NULL)
RETURNS TABLE(id uuid, nome text, telefone text, email text, empreendimento text, origem text,
  stage_id uuid, stage_nome text, stage_tipo text, corretor_id uuid, corretor_nome text,
  created_at timestamptz, updated_at timestamptz, observacoes text, arquivado boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tel text := regexp_replace(COALESCE(p_telefone,''), '\D', '', 'g');
BEGIN
  IF NOT (has_role(auth.uid(),'gestor') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor')) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  IF COALESCE(p_nome,'')='' AND length(v_tel)<4 AND COALESCE(p_email,'')='' AND COALESCE(p_empreendimento,'')='' AND COALESCE(p_origem,'')='' AND p_data_inicio IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT l.id, l.nome, l.telefone, l.email, l.empreendimento, l.origem, l.stage_id, s.nome::text, s.tipo::text,
         l.corretor_id, p.nome::text, l.created_at, l.updated_at, l.observacoes, COALESCE(l.arquivado,false)
  FROM pipeline_leads l
  LEFT JOIN pipeline_stages s ON s.id = l.stage_id
  LEFT JOIN profiles p ON p.user_id = l.corretor_id
  WHERE (COALESCE(l.arquivado,false) OR s.tipo = 'descarte' OR l.corretor_id IS NULL OR p.user_id IS NULL OR COALESCE(p.ativo,true) = false)
    AND (COALESCE(p_nome,'')='' OR l.nome ILIKE '%'||p_nome||'%')
    AND (length(v_tel)<4 OR regexp_replace(COALESCE(l.telefone,''), '\D', '', 'g') LIKE '%'||v_tel||'%')
    AND (COALESCE(p_email,'')='' OR l.email ILIKE '%'||p_email||'%')
    AND (COALESCE(p_empreendimento,'')='' OR l.empreendimento ILIKE '%'||p_empreendimento||'%')
    AND (COALESCE(p_origem,'')='' OR l.origem ILIKE '%'||p_origem||'%')
    AND (p_data_inicio IS NULL OR l.created_at >= p_data_inicio)
    AND (p_data_fim IS NULL OR l.created_at <= p_data_fim)
  ORDER BY l.updated_at DESC LIMIT 200;
END $$;

CREATE OR REPLACE FUNCTION public.repassar_lead_gestor(p_lead_id uuid, p_corretor_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_lead pipeline_leads%ROWTYPE; v_novo uuid; v_gerente text;
BEGIN
  IF NOT has_role(auth.uid(),'gestor') THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  SELECT * INTO v_lead FROM pipeline_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','nao_encontrado'); END IF;
  IF NOT (lead_livre_para_repasse(p_lead_id) OR (v_lead.corretor_id IS NOT NULL AND is_lead_in_my_team(v_lead.corretor_id)) OR v_lead.created_by = auth.uid()) THEN
    RETURN jsonb_build_object('ok',false,'erro','com_outro_corretor');
  END IF;
  IF NOT is_lead_in_my_team(p_corretor_id) THEN RETURN jsonb_build_object('ok',false,'erro','corretor_fora_da_equipe'); END IF;
  SELECT id INTO v_novo FROM pipeline_stages WHERE tipo = 'novo_lead' LIMIT 1;
  SELECT nome INTO v_gerente FROM profiles WHERE user_id = auth.uid();
  UPDATE pipeline_leads SET corretor_id = p_corretor_id, aceite_status = 'aceito', aceito_em = now(), aceite_expira_em = NULL,
    arquivado = false, stage_id = v_novo, stage_changed_at = now(), updated_at = now() WHERE id = p_lead_id;
  INSERT INTO pipeline_historico(pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
  VALUES (p_lead_id, v_lead.stage_id, v_novo, auth.uid(), 'Lead repassado via Busca por '||COALESCE(v_gerente,'gerente')||COALESCE(' — motivo: '||NULLIF(p_motivo,''),''));
  INSERT INTO pipeline_anotacoes(pipeline_lead_id, conteudo, autor_id, autor_nome)
  VALUES (p_lead_id, '🔄 Lead repassado via Busca por '||COALESCE(v_gerente,'gerente')||COALESCE(' — Motivo: '||NULLIF(p_motivo,''),''), auth.uid(), 'Sistema');
  RETURN jsonb_build_object('ok',true);
END $$;

REVOKE ALL ON FUNCTION public.lead_livre_para_repasse(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buscar_leads_repasse_gestor(text,text,text,text,text,timestamptz,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.repassar_lead_gestor(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_livre_para_repasse(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_leads_repasse_gestor(text,text,text,text,text,timestamptz,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repassar_lead_gestor(uuid,uuid,text) TO authenticated;