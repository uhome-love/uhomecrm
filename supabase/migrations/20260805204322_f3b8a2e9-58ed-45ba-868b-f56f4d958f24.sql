ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS motivo_descarte_code text;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_motivo_descarte_code
  ON public.pipeline_leads (motivo_descarte_code)
  WHERE motivo_descarte_code IS NOT NULL;

COMMENT ON COLUMN public.pipeline_leads.motivo_descarte_code IS
  'Código canônico do motivo de descarte (ver src/lib/discardReasons.ts). motivo_descarte (texto) permanece como histórico.';

-- Backfill derivado: classifica o TEXTO legado pelo CONTEUDO (nunca pelo prefixo Descartado/Inativado).
-- Trigger de ultima_acao_at desabilitado durante o backfill para nao distorcer a regua de estagnacao.
ALTER TABLE public.pipeline_leads DISABLE TRIGGER trg_update_lead_ultima_acao;

WITH classificado AS (
  SELECT
    id,
    CASE
      WHEN m ILIKE '%lgpd%' OR m ILIKE '%retirada do nome%' OR m ILIKE '%retirar o nome%' THEN 'lgpd'
      WHEN m ILIKE '%contato errado%' OR m ILIKE '%numero invalido%' OR m ILIKE '%número inválido%'
        OR m ILIKE '%telefone invalido%' OR m ILIKE '%telefone inválido%' OR m ILIKE '%contato invalido%'
        OR m ILIKE '%contato inválido%' OR m ILIKE '%numero errado%' OR m ILIKE '%número errado%' THEN 'contato_invalido'
      WHEN m ILIKE '%nao quer mais contato%' OR m ILIKE '%não quer mais contato%'
        OR m ILIKE '%nao quer contato%' OR m ILIKE '%não quer contato%'
        OR m ILIKE '%pediu para nao%' OR m ILIKE '%pediu para não%' THEN 'nao_quer_contato'
      WHEN m ILIKE '%duplicad%' THEN 'duplicado'
      WHEN m ILIKE '%comprou com outro%' OR m ILIKE '%comprou outro%' OR m ILIKE '%comprou_outro%'
        OR m ILIKE '%comprou com a concorr%' THEN 'comprou_outro'
      WHEN m ILIKE '%desist%' THEN 'desistiu_compra'
      WHEN m ILIKE '%sem perfil%' OR m ILIKE '%sem_perfil%' THEN 'sem_perfil'
      WHEN m ILIKE '%sem condi%financ%' OR m ILIKE '%nao tem renda%' OR m ILIKE '%não tem renda%'
        OR m ILIKE '%credito negado%' OR m ILIKE '%crédito negado%' OR m ILIKE '%nao aprovou credito%'
        OR m ILIKE '%não aprovou crédito%' OR m ILIKE '%restri%o no nome%' THEN 'sem_condicao_financeira'
      WHEN m ILIKE '%imovel nao atende%' OR m ILIKE '%imóvel não atende%'
        OR m ILIKE '%nao atende necessidade%' OR m ILIKE '%não atende necessidade%'
        OR m ILIKE '%nao gostou do imovel%' OR m ILIKE '%não gostou do imóvel%' THEN 'imovel_nao_atende'
      WHEN m ILIKE '%sem interesse%' OR m ILIKE '%nao tem interesse%' OR m ILIKE '%não tem interesse%'
        OR m ILIKE '%sem_interesse%' THEN 'sem_interesse_momento'
      WHEN m ILIKE '%lead antigo%' OR m ILIKE '%leads antigos%' OR m ILIKE '%base antiga%'
        OR m ILIKE '%limpeza de base%' THEN 'lead_antigo'
      WHEN m ILIKE '%nao atende%' OR m ILIKE '%não atende%' OR m ILIKE '%nao responde%'
        OR m ILIKE '%não responde%' OR m ILIKE '%sem retorno%' OR m ILIKE '%sem contato%'
        OR m ILIKE '%nao atendeu%' OR m ILIKE '%não atendeu%' THEN 'nao_atende'
      ELSE NULL
    END AS code
  FROM (
    SELECT id, btrim(regexp_replace(motivo_descarte, '^(Descartado|Descarte|Inativado)\s*:\s*', '', 'i')) AS m
    FROM public.pipeline_leads
    WHERE motivo_descarte IS NOT NULL
      AND motivo_descarte_code IS NULL
  ) src
)
UPDATE public.pipeline_leads pl
SET motivo_descarte_code = c.code
FROM classificado c
WHERE pl.id = c.id
  AND c.code IS NOT NULL;

ALTER TABLE public.pipeline_leads ENABLE TRIGGER trg_update_lead_ultima_acao;