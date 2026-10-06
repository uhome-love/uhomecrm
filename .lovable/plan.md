# Primeiro contato: separar tentativa, contato efetivo e registro (só dados)

## O que conferi no banco
- Gatilho `trg_perf_primeiro_contato` (AFTER INSERT em `pipeline_atividades`) chama `perf_set_primeiro_contato`: guard de 1 dia + `perf_atividade_humana(tipo)` + preenche `primeiro_contato_em` se nulo.
- Consumidores de `primeiro_contato_em` (não serão tocados): `get_dashboard_gerente_v4_kpis`, `monitor_primeiro_contato_v1_coverage`, `rpc_perf_dashboard`, `get_relatorio_origem_performance`, `midia_funil`, `homi_meus_leads`.
- `pipeline_leads` já tem `campanha`, `campanha_id`, `corretor_id`, `anuncio`, `conjunto_anuncio`, `origem`, `stage_id`.
- Contagem do Lucas: 11.686 leads, 71.242 atividades, 10.045 com `primeiro_contato_em`, 0 leads com atividade humana e campo vazio — o backfill só popula colunas novas.

## Migration 1 (aditiva) — colunas + gatilho v2 + view
```sql
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS primeira_tentativa_em timestamptz,
  ADD COLUMN IF NOT EXISTS primeiro_registro_em timestamptz,
  ADD COLUMN IF NOT EXISTS primeiro_contato_origem text
    CONSTRAINT pipeline_leads_primeiro_contato_origem_chk
    CHECK (primeiro_contato_origem IN ('resultado','fallback'));

ALTER TABLE public.pipeline_atividades
  ADD COLUMN IF NOT EXISTS resultado_contato text
  CONSTRAINT pipeline_atividades_resultado_contato_chk CHECK (resultado_contato IN
   ('atendeu','nao_atendeu','caixa_postal','numero_errado','whatsapp_enviado','whatsapp_respondido'));

CREATE OR REPLACE FUNCTION public.perf_set_primeiro_contato()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tentativa boolean;
  v_contato_origem text;
BEGIN
  IF NEW.created_at IS NULL OR NEW.created_at < now() - interval '1 day' THEN RETURN NEW; END IF;
  IF NOT public.perf_atividade_humana(NEW.tipo) THEN RETURN NEW; END IF;

  v_tentativa := NEW.tipo IN ('whatsapp','ligacao','call','email','mensagem','presencial','contato','nao_atendeu');
  v_contato_origem := CASE
    WHEN NEW.resultado_contato IN ('atendeu','whatsapp_respondido') THEN 'resultado'
    -- TODO remover na Fase 3: fallback sem resultado_contato mantém comportamento antigo
    WHEN NEW.resultado_contato IS NULL THEN 'fallback'
    ELSE NULL END;

  UPDATE public.pipeline_leads SET
    primeiro_registro_em  = COALESCE(primeiro_registro_em, NEW.created_at),
    primeira_tentativa_em = COALESCE(primeira_tentativa_em, CASE WHEN v_tentativa THEN NEW.created_at END),
    primeiro_contato_origem = CASE WHEN primeiro_contato_em IS NULL AND v_contato_origem IS NOT NULL
                                   THEN v_contato_origem ELSE primeiro_contato_origem END,
    primeiro_contato_em   = COALESCE(primeiro_contato_em, CASE WHEN v_contato_origem IS NOT NULL THEN NEW.created_at END)
  WHERE id = NEW.pipeline_lead_id
    AND (primeiro_registro_em IS NULL
      OR (primeira_tentativa_em IS NULL AND v_tentativa)
      OR (primeiro_contato_em IS NULL AND v_contato_origem IS NOT NULL));
  RETURN NEW;
END $$;

CREATE OR REPLACE VIEW public.v_sla_primeiro_contato WITH (security_invoker = true) AS
SELECT id AS pipeline_lead_id, campanha, campanha_id, anuncio, conjunto_anuncio, origem,
  stage_id, corretor_id, created_at,
  primeira_tentativa_em, primeiro_contato_em, primeiro_contato_origem, primeiro_registro_em,
  EXTRACT(EPOCH FROM primeira_tentativa_em - created_at)/60 AS min_lead_tentativa,
  EXTRACT(EPOCH FROM primeiro_contato_em  - created_at)/60 AS min_lead_contato,
  EXTRACT(EPOCH FROM primeiro_registro_em - primeira_tentativa_em)/60 AS min_tentativa_registro
FROM public.pipeline_leads;
GRANT SELECT ON public.v_sla_primeiro_contato TO authenticated;
```
Mesmo nome de função → o gatilho existente passa a usar a v2. `security_invoker` respeita o RLS de `pipeline_leads`.

## Migration 2 — função de backfill (sem guard de 1 dia, só preenche nulos)
```sql
CREATE OR REPLACE FUNCTION public.perf_backfill_primeiro_contato()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  WITH agg AS (
    SELECT pipeline_lead_id,
      min(created_at) AS reg,
      min(created_at) FILTER (WHERE tipo IN
        ('whatsapp','ligacao','call','email','mensagem','presencial','contato','nao_atendeu')) AS tent,
      min(created_at) AS cont -- histórico: tudo fallback; TODO remover na Fase 3
    FROM public.pipeline_atividades
    WHERE perf_atividade_humana(tipo) AND created_at IS NOT NULL
    GROUP BY pipeline_lead_id)
  UPDATE public.pipeline_leads pl SET
    primeiro_registro_em  = COALESCE(pl.primeiro_registro_em,  a.reg),
    primeira_tentativa_em = COALESCE(pl.primeira_tentativa_em, a.tent),
    primeiro_contato_origem = CASE
      WHEN pl.primeiro_contato_origem IS NOT NULL THEN pl.primeiro_contato_origem
      WHEN COALESCE(pl.primeiro_contato_em, a.cont) IS NOT NULL THEN 'fallback' END,
    primeiro_contato_em   = COALESCE(pl.primeiro_contato_em, a.cont)
  FROM agg a WHERE pl.id = a.pipeline_lead_id
    AND ((pl.primeiro_registro_em IS NULL AND a.reg IS NOT NULL)
      OR (pl.primeira_tentativa_em IS NULL AND a.tent IS NOT NULL)
      OR (pl.primeiro_contato_em IS NULL AND a.cont IS NOT NULL)
      OR (pl.primeiro_contato_origem IS NULL AND COALESCE(pl.primeiro_contato_em, a.cont) IS NOT NULL));
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.perf_backfill_primeiro_contato() FROM PUBLIC, anon, authenticated;
```
Idempotente: nunca sobrescreve valor já preenchido (inclusive tentativa gravada pela UI na Fase 2). Segunda execução → 0.

## Execução
- As duas migrations na mesma janela, fora de 08–19h BRT, backfill logo em seguida.
- Reporto o retorno de `SELECT perf_backfill_primeiro_contato();` e rodo de novo para confirmar 0.
- Conferência rápida: nenhum `primeiro_contato_em` existente mudou (contagem segue 10.045+).

## Fora desta etapa
UI, consumidores de `primeiro_contato_em`, lista de `perf_atividade_humana`.
