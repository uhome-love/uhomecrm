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
        AND l.empreendimento_canonico_id = ANY(ARRAY[
          'bb4c82b5-741f-4b5a-8b6c-639f61971d4c',
          'ab8d5afb-143c-4714-ab72-2626f33b0256',
          '0fcb9384-a0dd-45c4-b035-24e896716a54',
          'fa06971e-f446-42ed-9d39-1527f50d9c05',
          'e7c4f1df-ebf2-4607-bae2-c47dfb189af1',
          '86accea7-c5f7-400e-994e-4e0b2e91ccdb',
          '7063a25e-1efa-464c-a7b9-5ad01c3d1765',
          '5dc1dfd4-0ac7-472d-a2b9-01dab53607d3'
        ]::uuid[])
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