# Primeiro contato: separar tentativa, contato efetivo e registro (só dados)

## O que conferi no banco
- Gatilho `trg_perf_primeiro_contato` (AFTER INSERT em `pipeline_atividades`) chama `perf_set_primeiro_contato`: guard de 1 dia + filtro `perf_atividade_humana(tipo)` + preenche `primeiro_contato_em` se nulo.
- Consumidores atuais de `primeiro_contato_em` (não serão tocados): `get_dashboard_gerente_v4_kpis`, `monitor_primeiro_contato_v1_coverage`, `rpc_perf_dashboard`, `get_relatorio_origem_performance`, `midia_funil`, `homi_meus_leads` (6 no banco; o 7º provavelmente está no app).
- `pipeline_leads` já tem `campanha`, `campanha_id`, `corretor_id`. Ainda não existem `primeira_tentativa_em`, `primeiro_registro_em`, `resultado_contato`.

## Migration 1 (aditiva) — colunas + gatilho v2 + view
```sql
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS primeira_tentativa_em timestamptz,
  ADD COLUMN IF NOT EXISTS primeiro_registro_em timestamptz;

ALTER TABLE public.pipeline_atividades
  ADD COLUMN IF NOT EXISTS resultado_contato text
  CONSTRAINT pipeline_atividades_resultado_contato_chk CHECK (resultado_contato IN
   ('atendeu','nao_atendeu','caixa_postal','numero_errado','whatsapp_enviado','whatsapp_respondido'));

CREATE OR REPLACE FUNCTION public.perf_set_primeiro_contato()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.created_at IS NULL OR NEW.created_at < now() - interval '1 day' THEN RETURN NEW; END IF;
  IF NOT public.perf_atividade_humana(NEW.tipo) THEN RETURN NEW; END IF;

  UPDATE public.pipeline_leads SET
    primeiro_registro_em  = COALESCE(primeiro_registro_em, NEW.created_at),
    primeira_tentativa_em = COALESCE(primeira_tentativa_em, NEW.created_at),
    primeiro_contato_em   = COALESCE(primeiro_contato_em,
      CASE
        WHEN NEW.resultado_contato IN ('atendeu','whatsapp_respondido') THEN NEW.created_at
        -- TODO remover na Fase 3: fallback sem resultado_contato mantém comportamento antigo
        WHEN NEW.resultado_contato IS NULL THEN NEW.created_at
        ELSE NULL
      END)
  WHERE id = NEW.pipeline_lead_id
    AND (primeiro_registro_em IS NULL OR primeira_tentativa_em IS NULL OR primeiro_contato_em IS NULL);
  RETURN NEW;
END $$;

CREATE OR REPLACE VIEW public.v_sla_primeiro_contato WITH (security_invoker = true) AS
SELECT id AS pipeline_lead_id, campanha, campanha_id, corretor_id, created_at,
  primeira_tentativa_em, primeiro_contato_em, primeiro_registro_em,
  EXTRACT(EPOCH FROM primeira_tentativa_em - created_at)/60 AS min_lead_tentativa,
  EXTRACT(EPOCH FROM primeiro_contato_em  - created_at)/60 AS min_lead_contato,
  EXTRACT(EPOCH FROM primeiro_registro_em - primeira_tentativa_em)/60 AS min_tentativa_registro
FROM public.pipeline_leads;
GRANT SELECT ON public.v_sla_primeiro_contato TO authenticated;
```
Mesmo nome de função → o gatilho existente passa a usar a v2 sem recriar. `security_invoker` faz a view respeitar o RLS de `pipeline_leads`.

## Migration 2 — função de backfill (sem guard de 1 dia)
```sql
CREATE OR REPLACE FUNCTION public.perf_backfill_primeiro_contato()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  WITH agg AS (
    SELECT pipeline_lead_id,
      min(created_at) AS reg,
      min(created_at) AS tent,
      min(created_at) FILTER (WHERE resultado_contato IN ('atendeu','whatsapp_respondido')
                              OR resultado_contato IS NULL) AS cont -- TODO remover fallback na Fase 3
    FROM public.pipeline_atividades
    WHERE perf_atividade_humana(tipo) AND created_at IS NOT NULL
    GROUP BY pipeline_lead_id)
  UPDATE public.pipeline_leads pl SET
    primeiro_registro_em = a.reg, primeira_tentativa_em = a.tent,
    primeiro_contato_em  = COALESCE(pl.primeiro_contato_em, a.cont)
  FROM agg a WHERE pl.id = a.pipeline_lead_id
    AND (pl.primeiro_registro_em IS DISTINCT FROM a.reg
      OR pl.primeira_tentativa_em IS DISTINCT FROM a.tent
      OR (pl.primeiro_contato_em IS NULL AND a.cont IS NOT NULL));
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.perf_backfill_primeiro_contato() FROM PUBLIC, anon, authenticated;
```
Idempotente: rodar 2x → segunda retorna 0. Execução: `SELECT perf_backfill_primeiro_contato();` fora do expediente, e reporto o número de linhas.

## Decisões a confirmar
1. **`primeiro_contato_em` já preenchido não é sobrescrito** no backfill (só preenche os nulos). Assim nenhum dashboard muda valor histórico; só ganham dados leads que o guard de 1 dia deixou vazios. Antes de rodar, conto quantos são.
2. **"Qualquer tipo de contato"** = toda atividade que passa em `perf_atividade_humana` (mesma lista atual, sem alterar). Por enquanto tentativa e registro ficam iguais, porque o app ainda não grava a hora da tentativa separada — a diferença aparece quando a UI (próxima etapa) gravar `resultado_contato`.
3. Agenda: 2 migrations em dia separado ou fora de 08–19h BRT (regra do projeto).

## Fora desta etapa
UI, consumidores de `primeiro_contato_em`, lista de exclusão de `perf_atividade_humana`.
