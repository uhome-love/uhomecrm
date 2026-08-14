-- Produtividade · Gerente · Dia — v2: dever = A AGENDA DE PRIORIDADES.
-- Espelha a fila do corretor (src/hooks/useFilaDoDia.ts): um lead entra na agenda
-- quando bate um gatilho (negócio esfriando · pós-visita · no-show · lead novo <24h ·
-- retorno de hoje/lembrete vencendo · quente esfriando · vermelho sem próximo passo)
-- + cadência sem-contato. Novos/sem-contato/em-risco TODOS entram em "prioridades".
-- % do dever = prioridades da MANHÃ que receberam atividade hoje / total da manhã.
-- Saúde avaliada pelo toque ANTERIOR a hoje (senão o toque de hoje zera o relógio).
-- IMPORTANTE: esta lógica DEVE espelhar useFilaDoDia — andam juntas (fonte única a caminho).
-- Ressalva: "Dispensar" (some da fila 24h) é local do navegador, o banco não vê.

CREATE OR REPLACE FUNCTION public.get_produtividade_gerente_dia(p_data date DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_tz text := 'America/Sao_Paulo';
  v_data date := COALESCE(p_data, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'gestor') OR public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  WITH team AS (
    SELECT tm.user_id AS corretor, COALESCE(p.nome,'Corretor') AS nome
    FROM team_members tm LEFT JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.gerente_id = v_uid AND tm.status='ativo' AND tm.user_id IS NOT NULL AND tm.user_id <> v_uid),
  prev AS (SELECT pa.pipeline_lead_id, max(pa.created_at) AS mx FROM pipeline_atividades pa
    WHERE (pa.created_at AT TIME ZONE v_tz)::date < v_data GROUP BY 1),
  lt AS (  -- por lead: tem lembrete pendente? tem lembrete vencido/hoje (<=data)?
    SELECT tk.pipeline_lead_id AS lead_id, bool_or(true) AS tem_pend, bool_or(tk.vence_em <= v_data) AS tem_due
    FROM pipeline_tarefas tk WHERE tk.status='pendente' AND tk.pipeline_lead_id IS NOT NULL GROUP BY 1),
  leads AS (
    SELECT pl.corretor_id, ps.tipo AS stage_tipo,
      ((pl.ultimo_toque_at AT TIME ZONE v_tz)::date = v_data) AS tocou_hoje,
      (CASE WHEN (pl.ultimo_toque_at AT TIME ZONE v_tz)::date = v_data THEN pv.mx ELSE pl.ultimo_toque_at END) AS toque_ref,
      public.lead_saude_status(
        (CASE WHEN (pl.ultimo_toque_at AT TIME ZONE v_tz)::date = v_data THEN pv.mx ELSE pl.ultimo_toque_at END),
        COALESCE(pl.distribuido_em, pl.aceito_em, pl.created_at), ps.tipo) AS saude_manha,
      lower(COALESCE(pl.temperatura,'')) AS temp,
      COALESCE(pl.flag_status->>'status_negociacao','') AS status_neg,
      COALESCE(pl.flag_status->>'status_visita','') AS status_vis,
      (pl.created_at AT TIME ZONE v_tz)::date AS criado_dia,
      COALESCE(lt.tem_pend,false) AS tem_pend, COALESCE(lt.tem_due,false) AS tem_due
    FROM pipeline_leads pl
    JOIN team t ON t.corretor = pl.corretor_id
    JOIN pipeline_stages ps ON ps.id = pl.stage_id
    LEFT JOIN prev pv ON pv.pipeline_lead_id = pl.id
    LEFT JOIN lt ON lt.lead_id = pl.id
    WHERE pl.arquivado = false),
  prio AS (
    SELECT l.corretor_id, l.tocou_hoje,
      (l.stage_tipo NOT IN ('descarte','convertido','venda','caiu') AND l.saude_manha <> 'estagnado' AND (
        (l.stage_tipo = 'sem_contato' AND l.tem_due)
        OR (l.stage_tipo <> 'sem_contato' AND (
             ((l.stage_tipo IN ('proposta','contrato_gerado') OR l.status_neg IN ('proposta_solicitada','em_negociacao')) AND l.saude_manha <> 'verde')
          OR (l.stage_tipo='pos_visita' AND l.saude_manha <> 'verde')
          OR (l.status_vis='no_show' AND l.stage_tipo IN ('visita','pos_visita'))
          OR (l.stage_tipo='novo_lead' AND l.toque_ref IS NULL AND l.criado_dia >= v_data - 1)
          OR (l.tem_due)
          OR (l.temp IN ('quente','muito_quente','urgente') AND l.saude_manha <> 'verde')
          OR (l.saude_manha='vermelho' AND NOT l.tem_pend)
        ))
      )) AS is_prio
    FROM leads l),
  m_agenda AS (
    SELECT p.corretor_id AS corretor,
      count(*) FILTER (WHERE p.is_prio) AS esperado,
      count(*) FILTER (WHERE p.is_prio AND p.tocou_hoje) AS atendido
    FROM prio p GROUP BY 1),
  m_toques AS (SELECT p.corretor_id AS corretor, count(*) FILTER (WHERE p.tocou_hoje) AS n FROM prio p GROUP BY 1),
  m_vis_ag AS (SELECT ve.ator_id AS corretor, count(*) AS n FROM visita_eventos ve JOIN team t ON t.corretor = ve.ator_id
    WHERE ve.tipo='criada' AND (ve.created_at AT TIME ZONE v_tz)::date=v_data GROUP BY 1),
  m_vis_real AS (SELECT ve.ator_id AS corretor, count(*) AS n FROM visita_eventos ve JOIN team t ON t.corretor = ve.ator_id
    WHERE ve.status_novo='realizada' AND (ve.created_at AT TIME ZONE v_tz)::date=v_data GROUP BY 1),
  m_avancos AS (SELECT ph.movido_por AS corretor, count(*) AS n FROM pipeline_historico ph
    JOIN team t ON t.corretor = ph.movido_por JOIN pipeline_stages sa ON sa.id=ph.stage_anterior_id JOIN pipeline_stages sn ON sn.id=ph.stage_novo_id
    WHERE (ph.created_at AT TIME ZONE v_tz)::date=v_data AND sn.ordem > sa.ordem GROUP BY 1),
  m_pres AS (SELECT DISTINCT p.user_id AS corretor FROM roleta_presencas rp JOIN profiles p ON p.id = rp.corretor_id
    WHERE rp.data = v_data AND rp.chegou_em IS NOT NULL),
  base AS (SELECT t.corretor, t.nome, (mp2.corretor IS NOT NULL) AS presente,
      COALESCE(mg.esperado,0) AS prio_esp, COALESCE(mg.atendido,0) AS prio_at,
      COALESCE(mtk.n,0) AS toques, COALESCE(mva.n,0) AS vis_ag, COALESCE(mvr.n,0) AS vis_real, COALESCE(mav.n,0) AS avancos
    FROM team t
    LEFT JOIN m_agenda mg ON mg.corretor=t.corretor LEFT JOIN m_toques mtk ON mtk.corretor=t.corretor
    LEFT JOIN m_vis_ag mva ON mva.corretor=t.corretor LEFT JOIN m_vis_real mvr ON mvr.corretor=t.corretor
    LEFT JOIN m_avancos mav ON mav.corretor=t.corretor LEFT JOIN m_pres mp2 ON mp2.corretor=t.corretor),
  fim AS (SELECT b.*, CASE WHEN b.prio_esp=0 THEN NULL ELSE round(b.prio_at::numeric/b.prio_esp*100) END AS dever_pct FROM base b),
  linhas AS (  -- Parado = presente sem trabalhar; quem fez >=3 atividades mas cobriu pouco = Atenção
    SELECT f.*, CASE WHEN f.prio_esp=0 THEN 'sem_demanda' WHEN f.dever_pct>=70 THEN 'produtivo'
      WHEN f.dever_pct>=25 OR f.toques>=3 THEN 'atencao' ELSE 'parado' END AS situacao FROM fim f)
  SELECT jsonb_build_object('data', v_data, 'total', (SELECT count(*) FROM linhas), 'presentes', (SELECT count(*) FROM linhas WHERE presente),
    'placar', jsonb_build_object('produtivo',(SELECT count(*) FROM linhas WHERE situacao='produtivo'),'atencao',(SELECT count(*) FROM linhas WHERE situacao='atencao'),
      'parado',(SELECT count(*) FROM linhas WHERE situacao='parado'),'presente_parado',(SELECT count(*) FROM linhas WHERE situacao='parado' AND presente),'sem_demanda',(SELECT count(*) FROM linhas WHERE situacao='sem_demanda')),
    'corretores', COALESCE((SELECT jsonb_agg(jsonb_build_object('nome',l.nome,'presente',l.presente,'situacao',l.situacao,'dever_pct',l.dever_pct,'toques',l.toques,
        'prio_at',l.prio_at,'prio_esp',l.prio_esp,'vis_ag',l.vis_ag,'avancos',l.avancos,'vis_real',l.vis_real)
      ORDER BY l.dever_pct DESC NULLS LAST, l.nome) FROM linhas l), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END; $function$;
