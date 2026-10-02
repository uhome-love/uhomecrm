CREATE OR REPLACE FUNCTION public.sync_base_leads_do_pipeline(p_desde timestamptz DEFAULT now() - interval '2 days')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_n integer;
BEGIN
  WITH src AS (
    SELECT DISTINCT ON (right(pl.telefone_normalizado, 8))
      pl.id, pl.nome, pl.telefone, pl.telefone_normalizado,
      right(pl.telefone_normalizado, 8) AS tkey,
      lower(nullif(trim(pl.email), '')) AS email,
      pl.formulario, pl.campanha, pl.empreendimento, pl.empreendimento_canonico_id, pl.created_at
    FROM pipeline_leads pl
    WHERE pl.created_at >= p_desde
      AND pl.telefone_normalizado IS NOT NULL
      AND length(pl.telefone_normalizado) >= 8
    ORDER BY right(pl.telefone_normalizado, 8), pl.created_at DESC
  ), up AS (
    INSERT INTO base_leads (nome, telefone, telefone_normalizado, telefone_key, email, email_key,
      primeira_conversao_em, ultima_conversao_em, primeiro_formulario, ultimo_formulario, campanha,
      empreendimento_canonico_id, empreendimento_texto, fonte_dado, external_id, situacao_crm, pipeline_lead_id)
    SELECT s.nome, s.telefone, s.telefone_normalizado, s.tkey, s.email, s.email,
      s.created_at, s.created_at, s.formulario, s.formulario, s.campanha,
      s.empreendimento_canonico_id, s.empreendimento, 'pipeline', s.id::text, 'no_pipeline', s.id
    FROM src s
    ON CONFLICT (telefone_key) WHERE telefone_key IS NOT NULL DO UPDATE SET
      ultima_conversao_em = EXCLUDED.ultima_conversao_em,
      ultimo_formulario = COALESCE(EXCLUDED.ultimo_formulario, base_leads.ultimo_formulario),
      campanha = COALESCE(EXCLUDED.campanha, base_leads.campanha),
      empreendimento_canonico_id = COALESCE(EXCLUDED.empreendimento_canonico_id, base_leads.empreendimento_canonico_id),
      empreendimento_texto = COALESCE(EXCLUDED.empreendimento_texto, base_leads.empreendimento_texto),
      pipeline_lead_id = EXCLUDED.pipeline_lead_id,
      total_conversoes = base_leads.total_conversoes + 1
    WHERE base_leads.ultima_conversao_em IS NULL OR EXCLUDED.ultima_conversao_em > base_leads.ultima_conversao_em
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM up;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.sync_base_leads_do_pipeline(timestamptz) FROM PUBLIC, anon, authenticated;

SELECT public.sync_base_leads_do_pipeline('2026-08-01 00:00:00-03'::timestamptz);

SELECT cron.schedule('sync-base-leads-do-pipeline', '7 * * * *', $c$SELECT public.sync_base_leads_do_pipeline();$c$);