-- ============================================================
-- Meta Custom Audience sync — estrutura (aditiva)
-- ============================================================

CREATE TABLE public.meta_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segmento_chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  definicao jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta_custom_audience_id text,
  ad_account_id text,
  ativo boolean NOT NULL DEFAULT true,
  ultima_sync_at timestamptz,
  ultimo_total_elegivel integer NOT NULL DEFAULT 0,
  ultimo_total_enviado integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meta_audiences TO authenticated;
GRANT ALL ON public.meta_audiences TO service_role;

ALTER TABLE public.meta_audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_audiences_read_gestao"
ON public.meta_audiences FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);

CREATE TABLE public.meta_audience_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id uuid REFERENCES public.meta_audiences(id) ON DELETE SET NULL,
  segmento_chave text NOT NULL,
  dry_run boolean NOT NULL DEFAULT true,
  total_elegivel integer NOT NULL DEFAULT 0,
  enviados integer NOT NULL DEFAULT 0,
  recebidos integer,
  invalidos integer,
  erro text,
  duracao_ms integer,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meta_audience_runs_seg ON public.meta_audience_runs (segmento_chave, created_at DESC);

GRANT SELECT ON public.meta_audience_runs TO authenticated;
GRANT ALL ON public.meta_audience_runs TO service_role;

ALTER TABLE public.meta_audience_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_audience_runs_read_gestao"
ON public.meta_audience_runs FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);

CREATE TRIGGER trg_meta_audiences_updated_at
BEFORE UPDATE ON public.meta_audiences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- Normalização de telefone no padrão que o Meta espera:
-- somente dígitos, com DDI 55 para números BR de 10/11 dígitos.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._meta_aud_phone_e164(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN d IS NULL OR length(d) < 10 THEN NULL
    WHEN length(d) IN (10, 11) THEN '55' || d
    WHEN length(d) IN (12, 13) AND left(d, 2) = '55' THEN d
    ELSE d
  END
  FROM (SELECT public._capi_normalize_phone(p_phone) AS d) s
$$;

-- ------------------------------------------------------------
-- Membros de um público, SOMENTE hasheados.
-- definicao:
--   { "segmento": "compradores" | "em_negociacao" | "qualificados"
--                 | "base_ativa_com_contato" | "por_empreendimento",
--     "empreendimento_ids": ["uuid", ...],
--     "lead_ids": ["uuid", ...] }
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_meta_audience_membros(
  _definicao jsonb,
  _limit integer DEFAULT 10000,
  _offset integer DEFAULT 0
)
RETURNS TABLE (email_sha256 text, phone_sha256 text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.rpc_meta_audience_membros(jsonb, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_meta_audience_membros(jsonb, integer, integer) TO service_role;