
-- 1) Config: novos parâmetros de inteligência de disparo
ALTER TABLE public.reengajamento_config
  ADD COLUMN IF NOT EXISTS freq_cooldown_dias integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS retry_131049_dias integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS retry_max_tentativas integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS warmup_inicial integer NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS warmup_incremento_pct integer NOT NULL DEFAULT 20;

-- 2) Contatos de leads ATIVOS no pipeline (telefone + e-mail) — guarda de exclusividade
CREATE OR REPLACE VIEW public.v_pipeline_ativo_contatos AS
SELECT DISTINCT
  right(regexp_replace(coalesce(pl.telefone_normalizado, pl.telefone), '\D', '', 'g'), 8) AS telefone_last8,
  lower(nullif(trim(pl.email), '')) AS email
FROM public.pipeline_leads pl
WHERE pl.arquivado = false
  AND pl.stage_id <> '1dd66c25-3848-4053-9f66-82e902989b4d';

-- 3) Último envio de marketing por telefone (reengajamento + campanhas) — governador de frequência
CREATE OR REPLACE VIEW public.v_ultimo_marketing_por_telefone AS
SELECT last8, max(sent_at) AS ultimo_envio
FROM (
  SELECT right(regexp_replace(phone, '\D', '', 'g'), 8) AS last8, sent_at
  FROM public.reengajamento_meta_disparos
  WHERE phone IS NOT NULL AND sent_at IS NOT NULL
  UNION ALL
  SELECT right(regexp_replace(coalesce(telefone_normalizado, telefone), '\D', '', 'g'), 8) AS last8, sent_at
  FROM public.whatsapp_campaign_sends
  WHERE coalesce(telefone_normalizado, telefone) IS NOT NULL AND sent_at IS NOT NULL
) t
WHERE last8 ~ '^\d{8}$'
GROUP BY last8;

GRANT SELECT ON public.v_pipeline_ativo_contatos TO authenticated, service_role;
GRANT SELECT ON public.v_ultimo_marketing_por_telefone TO authenticated, service_role;

-- 4) Função de entregabilidade por lista de Oferta Ativa
CREATE OR REPLACE FUNCTION public.reengajamento_deliverability_listas()
RETURNS TABLE (
  lista_id uuid,
  nome text,
  empreendimento text,
  total integer,
  limpos integer,
  em_cooldown integer,
  bloqueados integer,
  pipeline_ativos integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT oa.lista_id, oa.id,
      right(regexp_replace(coalesce(oa.telefone_normalizado, oa.telefone), '\D', '', 'g'), 8) AS last8
    FROM public.oferta_ativa_leads oa
    WHERE oa.status IN ('na_fila', 'em_cooldown')
      AND coalesce(oa.telefone_normalizado, oa.telefone) IS NOT NULL
  ),
  pa AS (
    SELECT DISTINCT telefone_last8 FROM public.v_pipeline_ativo_contatos
    WHERE telefone_last8 ~ '^\d{8}$'
  ),
  flagged AS (
    SELECT b.lista_id, b.id,
      (ms.telefone_last8 IS NOT NULL AND ms.suprimir_ate IS NULL) AS bloqueado_perm,
      (ms.telefone_last8 IS NOT NULL AND ms.suprimir_ate IS NOT NULL AND ms.suprimir_ate > now()) AS em_cd,
      (pa.telefone_last8 IS NOT NULL) AS pipeline_ativo
    FROM base b
    LEFT JOIN public.meta_supressao ms ON ms.telefone_last8 = b.last8
    LEFT JOIN pa ON pa.telefone_last8 = b.last8
  )
  SELECT f.lista_id, l.nome, l.empreendimento,
    count(*)::int AS total,
    count(*) FILTER (WHERE NOT f.bloqueado_perm AND NOT f.em_cd AND NOT f.pipeline_ativo)::int AS limpos,
    count(*) FILTER (WHERE f.em_cd AND NOT f.bloqueado_perm)::int AS em_cooldown,
    count(*) FILTER (WHERE f.bloqueado_perm)::int AS bloqueados,
    count(*) FILTER (WHERE f.pipeline_ativo AND NOT f.bloqueado_perm AND NOT f.em_cd)::int AS pipeline_ativos
  FROM flagged f
  JOIN public.oferta_ativa_listas l ON l.id = f.lista_id
  GROUP BY f.lista_id, l.nome, l.empreendimento
  ORDER BY limpos DESC;
$$;

GRANT EXECUTE ON FUNCTION public.reengajamento_deliverability_listas() TO authenticated, service_role;
