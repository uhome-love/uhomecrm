CREATE OR REPLACE FUNCTION public.atualizar_situacao_crm_base_leads()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_alterados int := 0;
BEGIN
  WITH pipe AS (
    SELECT DISTINCT right(telefone_normalizado, 8) AS k
    FROM pipeline_leads WHERE telefone_normalizado IS NOT NULL
  ), oa AS (
    SELECT DISTINCT right(oal.telefone_normalizado, 8) AS k
    FROM oferta_ativa_leads oal
    JOIN oferta_ativa_listas l ON l.id = oal.lista_id
    WHERE oal.telefone_normalizado IS NOT NULL
      AND l.status = 'liberada'
      AND (l.expira_em IS NULL OR l.expira_em > now())
      AND oal.status NOT IN ('devolvido_base','migrado','descartado')
  ), calc AS (
    SELECT b.id,
      CASE
        WHEN p.k IS NOT NULL AND o.k IS NOT NULL THEN 'ambos'
        WHEN p.k IS NOT NULL THEN 'no_pipeline'
        WHEN o.k IS NOT NULL THEN 'na_oferta_ativa'
        ELSE 'inedito'
      END AS nova
    FROM base_leads b
    LEFT JOIN pipe p ON p.k = b.telefone_key
    LEFT JOIN oa o ON o.k = b.telefone_key
  )
  UPDATE base_leads b SET situacao_crm = c.nova
  FROM calc c
  WHERE c.id = b.id AND b.situacao_crm IS DISTINCT FROM c.nova;

  GET DIAGNOSTICS v_alterados = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'atualizados', v_alterados);
END;
$function$;