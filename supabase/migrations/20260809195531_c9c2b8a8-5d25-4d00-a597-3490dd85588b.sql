CREATE OR REPLACE FUNCTION public.rpc_meta_audience_membros(_definicao jsonb, _limit integer DEFAULT 10000, _offset integer DEFAULT 0)
 RETURNS TABLE(email_sha256 text, phone_sha256 text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH params AS (
  SELECT
    coalesce(_definicao->>'segmento', 'base_ativa_com_contato') AS segmento,
    CASE WHEN jsonb_typeof(_definicao->'empreendimento_ids') = 'array'
      THEN ARRAY(SELECT (jsonb_array_elements_text(_definicao->'empreendimento_ids'))::uuid)
      ELSE NULL END AS emp_ids,
    CASE WHEN jsonb_typeof(_definicao->'lead_ids') = 'array'
      THEN ARRAY(SELECT (jsonb_array_elements_text(_definicao->'lead_ids'))::uuid)
      ELSE NULL END AS lead_ids
),
base AS (
  SELECT
    l.id,
    l.email,
    public._meta_aud_phone_e164(coalesce(l.telefone, l.telefone2)) AS fone,
    l.updated_at
  FROM public.pipeline_leads l
  JOIN public.pipeline_stages s ON s.id = l.stage_id
  CROSS JOIN params p
  WHERE coalesce(l.arquivado, false) = false
    AND s.tipo NOT IN ('descarte', 'caiu')
    AND (
      (l.email IS NOT NULL AND btrim(l.email) <> '')
      OR public._meta_aud_phone_e164(coalesce(l.telefone, l.telefone2)) IS NOT NULL
    )
    AND (p.lead_ids IS NULL OR l.id = ANY(p.lead_ids))
    AND (
      p.segmento <> 'por_empreendimento'
      OR (p.emp_ids IS NOT NULL AND l.empreendimento_canonico_id = ANY(p.emp_ids))
    )
    AND (
      p.segmento <> 'qualificados'
      OR s.tipo IN ('qualificacao','aquecimento','visita','pos_visita','proposta','contrato_gerado','venda')
    )
    AND (
      p.segmento <> 'invest_qualificados'
      OR (
        s.tipo IN ('qualificacao','aquecimento','visita','pos_visita','proposta','contrato_gerado','venda')
        AND l.empreendimento ILIKE ANY(ARRAY['%connect%','%arch%','%shift%','%skyglass%','%orygem%'])
      )
    )
    AND (
      p.segmento <> 'em_negociacao'
      OR EXISTS (
        SELECT 1 FROM public.negocios n
        WHERE n.pipeline_lead_id = l.id
          AND n.fase IN ('em_negociacao','contrato')
          AND n.status = 'ativo'
      )
    )
    AND (
      p.segmento <> 'compradores'
      OR EXISTS (
        SELECT 1 FROM public.negocios n
        WHERE n.pipeline_lead_id = l.id
          AND n.fase = 'ganho'
          AND n.status = 'ativo'
      )
    )
),
sem_optout AS (
  SELECT b.*
  FROM base b
  WHERE NOT EXISTS (
    SELECT 1 FROM public.meta_supressao ms
    WHERE b.fone IS NOT NULL
      AND ms.telefone_last8 = right(b.fone, 8)
      AND (ms.suprimir_ate IS NULL OR ms.suprimir_ate > now())
  )
),
dedup AS (
  SELECT DISTINCT ON (coalesce(fone, 'e:' || lower(btrim(email))))
    email, fone
  FROM sem_optout
  ORDER BY coalesce(fone, 'e:' || lower(btrim(email))), updated_at DESC NULLS LAST
)
SELECT
  public._capi_sha256(email) AS email_sha256,
  public._capi_sha256(fone)  AS phone_sha256
FROM dedup
ORDER BY 1 NULLS LAST, 2 NULLS LAST
LIMIT greatest(coalesce(_limit, 10000), 0)
OFFSET greatest(coalesce(_offset, 0), 0)
$function$;