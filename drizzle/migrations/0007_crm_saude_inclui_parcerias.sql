CREATE OR REPLACE FUNCTION public.crm_saude_corretor(p_auth_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  SELECT count(*) AS total,
         count(*) FILTER (WHERE saude <> 'estagnado') AS ativos,
         count(*) FILTER (WHERE saude = 'verde') AS em_dia,
         count(*) FILTER (WHERE saude IN ('ambar','vermelho')) AS a_atualizar,
         count(*) FILTER (WHERE saude = 'ambar') AS ambar,
         count(*) FILTER (WHERE saude = 'vermelho') AS vermelho,
         count(*) FILTER (WHERE saude = 'estagnado') AS estagnado
    INTO r
  FROM (
    SELECT public.lead_saude_status(pl.ultimo_toque_at, COALESCE(pl.distribuido_em, pl.created_at), st.tipo, pl.estagnacao_carencia_ate) AS saude
    FROM public.pipeline_leads pl
    JOIN public.pipeline_stages st ON st.id = pl.stage_id
    WHERE COALESCE(pl.arquivado,false) = false AND st.pipeline_tipo = 'leads'
      AND st.tipo NOT IN ('venda','caiu','descarte','convertido')
      AND (pl.corretor_id = p_auth_user_id
           OR EXISTS (SELECT 1 FROM public.pipeline_parcerias pp
                      WHERE pp.pipeline_lead_id = pl.id AND pp.status = 'ativa'
                        AND (pp.corretor_parceiro_id = p_auth_user_id OR pp.corretor_principal_id = p_auth_user_id)))
  ) b;

  IF r.total = 0 THEN
    RETURN jsonb_build_object('estado','sem_carteira','pct',NULL,'total',0,'ativos',0,'em_dia',0,'a_atualizar',0,'ambar',0,'vermelho',0,'estagnado',0);
  ELSIF r.ativos = 0 THEN
    RETURN jsonb_build_object('estado','dados_insuficientes','pct',NULL,'total',r.total,'ativos',0,'em_dia',0,'a_atualizar',0,'ambar',0,'vermelho',0,'estagnado',r.estagnado);
  END IF;
  RETURN jsonb_build_object('estado','calculado',
    'pct', 100.0 * r.em_dia / r.ativos,
    'total', r.total, 'ativos', r.ativos, 'em_dia', r.em_dia,
    'a_atualizar', r.a_atualizar, 'ambar', r.ambar, 'vermelho', r.vermelho, 'estagnado', r.estagnado);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('estado','erro','pct',NULL,'erro',SQLERRM);
END $function$;