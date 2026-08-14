-- Produtividade · Gerente · Dia — RPC "o corretor foi produtivo hoje?".
-- Escopo = time do gerente logado (team_members.gerente_id = auth.uid()), gate gestor/admin/diretor.
-- Dever do dia (régua do Lucas), medido por SAÚDE (fonte única lead_saude_status):
--   • cobertura = leads em risco (vermelho/âmbar) tocados / total em risco — avaliado pela saúde
--     "de manhã" (toque ANTERIOR a hoje), senão o próprio toque zera o relógio e esconde o lead;
--   • novos atendidos / recebidos no dia; • sem-contato em risco tocados; • ≥1 visita agendada.
-- Estagnado fica FORA (é risco/saúde, não mérito). Presença: roleta_presencas.corretor_id = profiles.id.
-- Reusa ordem das etapas (pipeline_stages.ordem) p/ avanço. Mesmo padrão de time do cockpit.

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

  WITH team AS (  -- exclui o próprio gerente (ele aparece como membro do próprio time)
    SELECT tm.user_id AS corretor, COALESCE(p.nome,'Corretor') AS nome
    FROM team_members tm LEFT JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.gerente_id = v_uid AND tm.status='ativo' AND tm.user_id IS NOT NULL AND tm.user_id <> v_uid),
  -- último toque ANTES do dia (pra saber a saúde "de manhã", sem o toque de hoje mascarar)
  prev AS (
    SELECT pa.pipeline_lead_id, max(pa.created_at) AS mx
    FROM pipeline_atividades pa WHERE (pa.created_at AT TIME ZONE v_tz)::date < v_data GROUP BY 1),
  leads AS (
    SELECT pl.id, pl.corretor_id, ps.tipo AS stage_tipo,
           (pl.ultimo_toque_at AT TIME ZONE v_tz)::date AS toque_dia,
           public.lead_saude_status(
             CASE WHEN (pl.ultimo_toque_at AT TIME ZONE v_tz)::date = v_data THEN pv.mx ELSE pl.ultimo_toque_at END,
             COALESCE(pl.distribuido_em, pl.aceito_em, pl.created_at), ps.tipo) AS saude_manha
    FROM pipeline_leads pl
    JOIN team t ON t.corretor = pl.corretor_id
    JOIN pipeline_stages ps ON ps.id = pl.stage_id
    LEFT JOIN prev pv ON pv.pipeline_lead_id = pl.id
    WHERE pl.arquivado = false),
  m_risco AS (  -- "deve tocar" = em risco por saúde (vermelho/âmbar), fora sem-contato
    SELECT l.corretor_id AS corretor, count(*) AS devido,
      count(*) FILTER (WHERE l.toque_dia = v_data) AS tocado
    FROM leads l WHERE l.saude_manha IN ('vermelho','ambar') AND l.stage_tipo <> 'sem_contato' GROUP BY 1),
  m_sc AS (
    SELECT l.corretor_id AS corretor, count(*) AS devido,
      count(*) FILTER (WHERE l.toque_dia = v_data) AS tocado
    FROM leads l WHERE l.stage_tipo = 'sem_contato' AND l.saude_manha IN ('vermelho','ambar') GROUP BY 1),
  m_novos AS (
    SELECT pl.corretor_id AS corretor, count(*) AS recebidos,
      count(*) FILTER (WHERE (pl.ultimo_toque_at AT TIME ZONE v_tz)::date = v_data) AS atendidos
    FROM pipeline_leads pl JOIN team t ON t.corretor = pl.corretor_id
    WHERE (pl.distribuido_em AT TIME ZONE v_tz)::date = v_data GROUP BY 1),
  m_ativos AS (
    SELECT l.corretor_id AS corretor, count(*) AS n FROM leads l
    WHERE l.stage_tipo NOT IN ('descarte','convertido','venda','caiu') GROUP BY 1),
  m_vis_ag AS (
    SELECT ve.ator_id AS corretor, count(*) AS n FROM visita_eventos ve JOIN team t ON t.corretor = ve.ator_id
    WHERE ve.tipo='criada' AND (ve.created_at AT TIME ZONE v_tz)::date = v_data GROUP BY 1),
  m_vis_real AS (
    SELECT ve.ator_id AS corretor, count(*) AS n FROM visita_eventos ve JOIN team t ON t.corretor = ve.ator_id
    WHERE ve.status_novo='realizada' AND (ve.created_at AT TIME ZONE v_tz)::date = v_data GROUP BY 1),
  m_avancos AS (
    SELECT ph.movido_por AS corretor, count(*) AS n FROM pipeline_historico ph
    JOIN team t ON t.corretor = ph.movido_por
    JOIN pipeline_stages sa ON sa.id = ph.stage_anterior_id
    JOIN pipeline_stages sn ON sn.id = ph.stage_novo_id
    WHERE (ph.created_at AT TIME ZONE v_tz)::date = v_data AND sn.ordem > sa.ordem GROUP BY 1),
  m_pres AS (  -- roleta_presencas.corretor_id = profiles.id → mapear p/ user_id
    SELECT DISTINCT p.user_id AS corretor FROM roleta_presencas rp JOIN profiles p ON p.id = rp.corretor_id
    WHERE rp.data = v_data AND rp.chegou_em IS NOT NULL),
  base AS (
    SELECT t.corretor, t.nome, (mp2.corretor IS NOT NULL) AS presente,
      COALESCE(mr.devido,0) AS risco_dev, COALESCE(mr.tocado,0) AS risco_toc,
      COALESCE(mn.recebidos,0) AS nov_rec, COALESCE(mn.atendidos,0) AS nov_at,
      COALESCE(ms.devido,0) AS sc_dev, COALESCE(ms.tocado,0) AS sc_toc,
      COALESCE(ma.n,0) AS tem_ativos, COALESCE(mva.n,0) AS vis_ag, COALESCE(mvr.n,0) AS vis_real, COALESCE(mav.n,0) AS avancos
    FROM team t
    LEFT JOIN m_risco mr ON mr.corretor=t.corretor LEFT JOIN m_novos mn ON mn.corretor=t.corretor
    LEFT JOIN m_sc ms ON ms.corretor=t.corretor LEFT JOIN m_ativos ma ON ma.corretor=t.corretor
    LEFT JOIN m_vis_ag mva ON mva.corretor=t.corretor LEFT JOIN m_vis_real mvr ON mvr.corretor=t.corretor
    LEFT JOIN m_avancos mav ON mav.corretor=t.corretor LEFT JOIN m_pres mp2 ON mp2.corretor=t.corretor),
  calc AS (
    SELECT b.*,
      CASE WHEN b.risco_dev>0 THEN LEAST(b.risco_toc::numeric / b.risco_dev, 1) END AS s_risco,
      CASE WHEN b.nov_rec>0 THEN LEAST(b.nov_at::numeric / b.nov_rec, 1) END AS s_nov,
      CASE WHEN b.sc_dev>0 THEN LEAST(b.sc_toc::numeric / b.sc_dev, 1) END AS s_sc,
      CASE WHEN b.tem_ativos>0 THEN LEAST(b.vis_ag,1)::numeric END AS s_vis
    FROM base b),
  scored AS (
    SELECT c.*,
      (COALESCE(c.s_risco*0.35,0)+COALESCE(c.s_nov*0.30,0)+COALESCE(c.s_sc*0.20,0)+COALESCE(c.s_vis*0.15,0)) AS num,
      (CASE WHEN c.s_risco IS NULL THEN 0 ELSE 0.35 END + CASE WHEN c.s_nov IS NULL THEN 0 ELSE 0.30 END
       + CASE WHEN c.s_sc IS NULL THEN 0 ELSE 0.20 END + CASE WHEN c.s_vis IS NULL THEN 0 ELSE 0.15 END) AS den
    FROM calc c),
  fim AS (SELECT s.*, CASE WHEN s.den = 0 THEN NULL ELSE round((s.num / s.den) * 100) END AS dever_pct FROM scored s),
  linhas AS (
    SELECT f.*, CASE WHEN f.den = 0 THEN 'sem_demanda' WHEN f.dever_pct >= 70 THEN 'produtivo'
      WHEN f.dever_pct >= 25 THEN 'atencao' ELSE 'parado' END AS situacao FROM fim f)
  SELECT jsonb_build_object(
    'data', v_data, 'total', (SELECT count(*) FROM linhas), 'presentes', (SELECT count(*) FROM linhas WHERE presente),
    'placar', jsonb_build_object(
      'produtivo', (SELECT count(*) FROM linhas WHERE situacao='produtivo'),
      'atencao', (SELECT count(*) FROM linhas WHERE situacao='atencao'),
      'parado', (SELECT count(*) FROM linhas WHERE situacao='parado'),
      'presente_parado', (SELECT count(*) FROM linhas WHERE situacao='parado' AND presente),
      'sem_demanda', (SELECT count(*) FROM linhas WHERE situacao='sem_demanda')),
    'corretores', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'nome', l.nome, 'presente', l.presente, 'situacao', l.situacao, 'dever_pct', l.dever_pct,
        'risco_toc', l.risco_toc, 'risco_dev', l.risco_dev, 'nov_at', l.nov_at, 'nov_rec', l.nov_rec,
        'sc_toc', l.sc_toc, 'sc_dev', l.sc_dev, 'vis_ag', l.vis_ag, 'avancos', l.avancos, 'vis_real', l.vis_real)
      ORDER BY l.dever_pct DESC NULLS LAST, l.nome)
      FROM linhas l), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END; $function$;
