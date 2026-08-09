CREATE OR REPLACE FUNCTION public.fn_atividade_carimba_toque()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF NEW.pipeline_lead_id IS NOT NULL
     AND NEW.tipo = ANY (ARRAY['ligacao','whatsapp','email','visita','contato','mensagem','reuniao','nao_atendeu','retorno']) THEN
    UPDATE public.pipeline_leads
      SET ultimo_toque_at = GREATEST(COALESCE(ultimo_toque_at, NEW.created_at), NEW.created_at)
      WHERE id = NEW.pipeline_lead_id;
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_atividade_carimba_toque ON public.pipeline_atividades;
CREATE TRIGGER trg_atividade_carimba_toque AFTER INSERT ON public.pipeline_atividades
  FOR EACH ROW EXECUTE FUNCTION public.fn_atividade_carimba_toque();

CREATE OR REPLACE FUNCTION public.fn_visita_carimba_toque()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF NEW.pipeline_lead_id IS NOT NULL THEN
    UPDATE public.pipeline_leads
      SET ultimo_toque_at = GREATEST(COALESCE(ultimo_toque_at, now()), now())
      WHERE id = NEW.pipeline_lead_id;
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_visita_carimba_toque ON public.visitas;
CREATE TRIGGER trg_visita_carimba_toque AFTER INSERT ON public.visitas
  FOR EACH ROW EXECUTE FUNCTION public.fn_visita_carimba_toque();

WITH toque AS (
  SELECT pipeline_lead_id AS lead_id, MAX(created_at) AS t
  FROM public.pipeline_atividades
  WHERE pipeline_lead_id IS NOT NULL
    AND tipo = ANY (ARRAY['ligacao','whatsapp','email','visita','contato','mensagem','reuniao','nao_atendeu','retorno'])
  GROUP BY 1),
vis AS (
  SELECT pipeline_lead_id AS lead_id, MAX(GREATEST(created_at, (data_visita::timestamp AT TIME ZONE 'America/Sao_Paulo'))) AS t
  FROM public.visitas WHERE pipeline_lead_id IS NOT NULL GROUP BY 1),
best AS (
  SELECT lead_id, MAX(t) AS t FROM (SELECT * FROM toque UNION ALL SELECT * FROM vis) u GROUP BY lead_id)
UPDATE public.pipeline_leads pl
  SET ultimo_toque_at = b.t
  FROM best b
  WHERE pl.id = b.lead_id AND b.t IS NOT NULL
    AND (pl.ultimo_toque_at IS NULL OR pl.ultimo_toque_at < b.t);

CREATE OR REPLACE FUNCTION public.lead_saude_status(p_ultimo_toque timestamptz, p_ref timestamptz, p_stage_tipo text)
RETURNS text LANGUAGE sql STABLE SET search_path TO 'public' AS $fn$
  WITH cfg AS (
    SELECT CASE p_stage_tipo
      WHEN 'novo_lead' THEN 1 WHEN 'sem_contato' THEN 2
      WHEN 'qualificacao' THEN 7 WHEN 'aquecimento' THEN 15
      WHEN 'visita' THEN 2 WHEN 'proposta' THEN 7 WHEN 'contrato_gerado' THEN 7
      ELSE 7 END AS prazo),
  d AS (
    SELECT EXTRACT(EPOCH FROM ((now() AT TIME ZONE 'America/Sao_Paulo')
             - (COALESCE(p_ultimo_toque, p_ref) AT TIME ZONE 'America/Sao_Paulo')))/86400.0 AS dias, prazo FROM cfg)
  SELECT CASE
    WHEN p_stage_tipo IN ('venda','caiu','descarte','convertido') THEN 'terminal'
    WHEN dias <= prazo THEN 'verde'
    WHEN dias <= prazo*2 THEN 'ambar'
    ELSE 'vermelho' END FROM d;
$fn$;

CREATE OR REPLACE FUNCTION public.rpc_carteira_saude(p_gerente_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_uid uuid := auth.uid(); v_is_admin boolean; v_is_gestor boolean;
  v_gerente uuid := p_gerente_id; v_user uuid := p_user_id; v_res jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '{}'::jsonb; END IF;
  v_is_admin := public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor');
  v_is_gestor := public.has_role(v_uid,'gestor');
  IF NOT v_is_admin THEN
    IF v_is_gestor THEN v_gerente := v_uid; v_user := NULL;
    ELSE v_user := v_uid; v_gerente := NULL; END IF;
  END IF;
  WITH team AS (
    SELECT user_id FROM public.team_members
    WHERE status='ativo' AND (v_gerente IS NULL OR gerente_id = v_gerente)),
  base AS (
    SELECT public.lead_saude_status(pl.ultimo_toque_at, COALESCE(pl.distribuido_em, pl.created_at), st.tipo) AS saude
    FROM public.pipeline_leads pl
    JOIN public.pipeline_stages st ON st.id = pl.stage_id
    WHERE COALESCE(pl.arquivado,false)=false AND st.pipeline_tipo='leads'
      AND st.tipo NOT IN ('venda','caiu','descarte','convertido')
      AND ((v_user IS NOT NULL AND pl.corretor_id = v_user)
           OR (v_user IS NULL AND pl.corretor_id IN (SELECT user_id FROM team))))
  SELECT jsonb_build_object(
    'total', count(*),
    'em_dia', count(*) FILTER (WHERE saude='verde'),
    'esfriando', count(*) FILTER (WHERE saude='ambar'),
    'frio', count(*) FILTER (WHERE saude='vermelho'),
    'pct_em_dia', round(100.0*count(*) FILTER (WHERE saude='verde')/NULLIF(count(*),0),1)
  ) INTO v_res FROM base;
  RETURN COALESCE(v_res,'{}'::jsonb);
END $fn$;
GRANT EXECUTE ON FUNCTION public.rpc_carteira_saude(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lead_saude_status(timestamptz,timestamptz,text) TO authenticated;