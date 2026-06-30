-- 1. T7 esgotado passa a ESTAGNAR (em vez de descartar)
CREATE OR REPLACE FUNCTION public.cadencia_sc_descartar_reengajavel(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  v_corretor  uuid;
  v_nome      text;
  v_gerente   uuid;
BEGIN
  SELECT corretor_id, nome INTO v_corretor, v_nome FROM pipeline_leads WHERE id = p_lead_id;

  UPDATE pipeline_leads
     SET estagnado = true,
         estagnado_em = now(),
         estagnado_aviso_em = NULL,
         estagnado_prazo_em = NULL,
         updated_at = now()
   WHERE id = p_lead_id AND stage_id = sem_contato AND estagnado IS NOT TRUE;

  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
  VALUES (p_lead_id, sem_contato, sem_contato, v_corretor,
          'Estagnado — cadência Sem Contato esgotada (T7 / prazo de 24h sem retorno). Aguardando decisão na Central de Leads Estagnados.');

  INSERT INTO pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, data, prioridade, status, created_by)
  VALUES (p_lead_id, 'sistema', 'Estagnado — cadência Sem Contato esgotada',
          'As 7 tentativas da cadência Sem Contato foram esgotadas sem retorno do lead. Lead movido para a Central de Leads Estagnados.',
          CURRENT_DATE, 'media', 'concluida', v_corretor);

  UPDATE lead_cadencia_sem_contato
     SET status = 'concluida', proxima_em = NULL, updated_at = now()
   WHERE pipeline_lead_id = p_lead_id;

  -- Notifica gestor (fallback corretor) + cargos de gestão
  SELECT gerente_id INTO v_gerente FROM team_members WHERE user_id = v_corretor AND status = 'ativo' LIMIT 1;
  INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, cargo_destino, dados)
  VALUES (COALESCE(v_gerente, v_corretor), 'alertas', 'lead_estagnado',
    '🛑 Lead estagnado: ' || COALESCE(v_nome, '(sem nome)'),
    'Cadência Sem Contato esgotada (T7 sem retorno). Defina o destino na Central de Leads Estagnados.',
    ARRAY['gestor','admin','diretor'], jsonb_build_object('lead_id', p_lead_id));
END;
$function$;

-- 2. Central de Leads Estagnados passa a enxergar leads estagnados fora da config (ex.: Sem Contato)
CREATE OR REPLACE FUNCTION public.get_pipeline_estagnacao()
RETURNS TABLE(lead_id uuid, nome text, empreendimento text, etapa text, stage_id uuid, corretor_id uuid, corretor_nome text, dias_limite integer, ultima_acao_humana timestamp with time zone, dias_sem_acao integer, categoria text, estagnado_prazo_em timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH cfg AS (SELECT c.stage_id, c.dias_limite FROM pipeline_estagnacao_config c WHERE c.ativo = true)
  SELECT pl.id, pl.nome, pl.empreendimento, s.nome, pl.stage_id, pl.corretor_id, pr.nome,
    COALESCE(cfg.dias_limite, 7) AS dias_limite,
    public._pipeline_ultima_acao_humana(pl.id) AS ult,
    EXTRACT(day FROM now() - public._pipeline_ultima_acao_humana(pl.id))::int,
    CASE
      WHEN pl.estagnado THEN 'estagnado'
      WHEN pl.estagnado_aviso_em IS NOT NULL AND pl.estagnado_prazo_em > now() THEN 'em_aviso'
      WHEN EXISTS (SELECT 1 FROM pipeline_parcerias pp WHERE pp.pipeline_lead_id=pl.id AND pp.status='ativa') THEN 'em_parceria'
      ELSE 'candidato'
    END,
    pl.estagnado_prazo_em
  FROM pipeline_leads pl
  JOIN pipeline_stages s ON s.id = pl.stage_id
  LEFT JOIN cfg ON cfg.stage_id = pl.stage_id
  LEFT JOIN profiles pr ON pr.user_id = pl.corretor_id
  WHERE pl.arquivado IS NOT TRUE
    AND pl.negocio_id IS NULL
    AND COALESCE(pl.modulo_atual,'') <> 'pos_vendas'
    AND (
      pl.estagnado = true
      OR pl.estagnado_aviso_em IS NOT NULL
      OR (cfg.stage_id IS NOT NULL
          AND public._pipeline_ultima_acao_humana(pl.id) < now() - (cfg.dias_limite || ' days')::interval)
    )
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'diretor')
      OR (
        public.has_role(auth.uid(),'gestor')
        AND pl.corretor_id IN (
          SELECT tm.user_id FROM public.team_members tm
          WHERE tm.gerente_id = auth.uid() AND tm.status = 'ativo'
        )
      )
    )
  ORDER BY ult ASC;
$function$;