# Backfill: LeadQualificado dos últimos 7 dias

## Situação verificada

- `meta_capi_queue` ainda não tem nenhum evento `LeadQualificado` (0 registros) — o gatilho novo só passa a valer para movimentações futuras.
- Nos últimos 7 dias, **237 leads** entraram na etapa Qualificação segundo `pipeline_historico` (entradas de 28/07 21:54 até 04/08 20:17 UTC).
- Todos os 237 têm e-mail, telefone ou `meta_lead_id`, ou seja, nenhum será descartado por falta de identificação.

## O que será feito

Uma migração única (executa uma vez, não cria objeto novo permanente) com um bloco `DO` que:

1. Seleciona, de `pipeline_historico`, a **última** entrada na etapa Qualificação por lead nos últimos 7 dias.
2. Para cada lead, chama `enqueue_meta_capi_event` com:
   - `p_event_name = 'LeadQualificado'`
   - `p_event_time` = timestamp real da entrada na etapa
   - `p_lead_event_source = 'Qualificado'`
   - `p_custom_data = '{}'::jsonb`
3. Registra um resumo em `ops_events` (quantidade processada) para auditoria.

O envio ao Meta continua sendo feito pelo dispatcher já existente, que consome a fila normalmente.

## Segurança do backfill

- **Sem duplicação**: o `event_id` é hash de lead + nome do evento + fonte + timestamp, e o insert usa `ON CONFLICT (event_id) DO NOTHING`. Reexecutar a migração não gera evento repetido.
- **Sem risco de rejeição por data**: a própria `enqueue_meta_capi_event` descarta eventos com mais de 7 dias, então nada inválido entra na fila.
- Nenhum lead é alterado, nenhuma etapa muda, nenhum gatilho é tocado.
- Volume esperado na fila: até 237 eventos, dentro do ritmo normal do dispatcher.

## Detalhes técnicos

```sql
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT h.pipeline_lead_id AS lead_id, max(h.created_at) AS entrou_em
    FROM public.pipeline_historico h
    JOIN public.pipeline_leads l ON l.id = h.pipeline_lead_id
    WHERE h.stage_novo_id = '1ea43190-44c8-43ec-91b4-409b055b0e58'::uuid
      AND h.created_at > now() - interval '7 days'
    GROUP BY 1
  LOOP
    PERFORM public.enqueue_meta_capi_event(
      p_lead_id => r.lead_id,
      p_event_name => 'LeadQualificado',
      p_event_time => r.entrou_em,
      p_custom_data => '{}'::jsonb,
      p_lead_event_source => 'Qualificado'
    );
    n := n + 1;
  END LOOP;
  INSERT INTO public.ops_events (fn, level, category, message, ctx)
  VALUES ('backfill_leadqualificado', 'info', 'capi', 'backfill_concluido',
          jsonb_build_object('leads_processados', n));
END $$;
```

Após a execução, confirmo a contagem de `LeadQualificado` na fila e quantos já saíram como `sent`.
