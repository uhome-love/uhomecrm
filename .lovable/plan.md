# Correção: leads do Meta não entram no CRM

## Diagnóstico confirmado (consultas feitas agora no banco)

1. Existem **duas versões da mesma função** `enqueue_meta_capi_event` no banco:
   - versão antiga com 5 parâmetros
   - versão nova com 7 parâmetros (criada na migração do CAPI de hoje), com os 2 últimos opcionais

   Como os 2 parâmetros novos são opcionais, uma chamada com 5 argumentos serve às duas — o Postgres não consegue escolher e devolve `function ... is not unique` (código 42725).

2. Todos os gatilhos de CAPI chamam a função com 5 argumentos:
   `trg_pipeline_lead_capi_insert`, `trg_pipeline_lead_capi`, `trg_visita_capi`, `trg_negocio_capi`.

3. Como o gatilho roda no mesmo `INSERT`, o erro **derruba a inserção inteira do lead**. Log confirmado às 20:26 UTC: lead "Gabriel Figueroa" (Casa Menino Deus v2) perdido, e ele **não existe** no CRM até agora.

4. **A entrada de leads está parada**: o último lead gravado em `pipeline_leads` foi às 18h UTC. Nenhum lead entrou depois disso — não é perda pontual, é uma parada total de ingestão desde a migração de hoje.

5. A rede de segurança (`meta-leads-backfill`) **não resolve**, porque ela também insere em `pipeline_leads` e cai no mesmo gatilho. Sem registro dela em `ops_events` nas últimas 24h.

## Plano de correção

### Fase 1 — Parar a hemorragia (migração DDL, urgente)
- Remover a assinatura antiga de 5 parâmetros (`DROP FUNCTION public.enqueue_meta_capi_event(uuid, text, timestamptz, jsonb, text)`), mantendo só a de 7.
- Verificar em seguida que existe apenas 1 assinatura e que um `INSERT` de teste em `pipeline_leads` passa.

### Fase 2 — Blindar contra recorrência (mesma migração)
- Envolver a chamada do CAPI nos 4 gatilhos em `BEGIN ... EXCEPTION WHEN OTHERS THEN` gravando um aviso em `ops_events` e seguindo com `RETURN NEW`.
  Regra que passa a valer: **rastreamento de marketing nunca pode derrubar a entrada de um lead**.
- Passar as chamadas dos gatilhos a usar parâmetros nomeados (`p_lead_id =>`, `p_event_name =>` ...), o que elimina ambiguidade caso alguém crie outra sobrecarga no futuro.

### Fase 3 — Recuperar o que foi perdido
- Rodar `meta-leads-backfill` com janela de 3 dias para reingerir os leads recusados desde ~18h UTC de hoje (a função é idempotente por `meta:{lead_id}`).
- Conferir o lead "Gabriel Figueroa" e comparar a contagem do dia com os números do app do Meta.
- Reportar quantos leads voltaram e quais permanecem sem correspondência.

### Fase 4 — Alerta para não repetir
- Regra em `edge-health-alert`: se `receive-meta-lead` registrar qualquer `Lead insert failed` na última hora, notifica admins.
- Regra complementar: se nenhum lead entrar em `pipeline_leads` por mais de 3 horas dentro do horário comercial BRT, alerta de "ingestão parada".

### Fase 5 — Validação ponta a ponta
- Simular uma entrada de lead pelo endpoint `receive-meta-lead` (lead de teste) e confirmar: lead gravado, distribuído na roleta e evento na `meta_capi_queue` com `status=sent`.
- Confirmar no painel de ingestão que os contadores voltaram a subir.

## Detalhes técnicos

- Migração 1 (DDL): `DROP FUNCTION` da sobrecarga de 5 args + `CREATE OR REPLACE` dos 4 gatilhos com `EXCEPTION` e parâmetros nomeados.
- Sem alteração de schema em `pipeline_leads`, `meta_capi_queue` ou RLS.
- Edge functions alteradas: apenas `edge-health-alert` (nova regra). `receive-meta-lead` e `meta-leads-backfill` ficam como estão.
- Nada muda no pipeline, PDN, roleta ou distribuição.
