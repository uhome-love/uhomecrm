# CAPI · provar a guarda e devolver vigilância ao Venda

Dois ajustes pequenos, independentes entre si. Nada muda no payload nem no disparo de eventos.

## O que a leitura mostrou (verificado agora)

- **A guarda nunca bloqueou nada**: `ops_events` com `category = 'capi_bloqueado_sem_lead_id'` tem **0 linhas** desde o deploy — e `fn = 'enqueue_meta_capi_event'` também tem 0 linhas no total.
- **A janela explica boa parte**: a nova função subiu hoje (08/08) à tarde. Hoje saíram só 10 `LeadQualificado` (contra 47 ontem, 55 anteontem), ou seja, a guarda viu poucas horas de tráfego. Mesmo assim: guarda sem nenhum bloqueio observado é guarda não testada.
- **Massa para barrar existe**: 25 leads criados nos últimos 7 dias estão sem `meta_lead_id`. Quando algum deles entrar na Qualificação, o bloqueio deve acontecer.
- **O Venda já disparou alerta de silêncio hoje** (`capi_evento_silencioso:Venda`, `eventos_7d = 5`) — então o corte de baixo volume não o silenciou por completo, mas o alerta é por tempo, não por realidade. Nos últimos 7 dias: **4 negócios em `ganho`** contra **5 eventos `Venda`** na fila. Hoje os números batem; não há falha em curso.

## Ajuste 1 · Autoteste da guarda (prova de que ela funciona)

Nova função de banco `public.capi_guarda_selftest()`, executada **1x por dia** pelo watchdog `capi-health-alert`:

1. Escolhe um lead real **sem** `meta_lead_id`.
2. Chama `enqueue_meta_capi_event` com o nome de evento reservado `GuardaSelfTest`.
3. Considera **PASSOU** se o retorno for `NULL` **e** aparecer uma linha nova em `ops_events` com `category = 'capi_bloqueado_sem_lead_id'`.
4. Limpa atrás de si: apaga qualquer linha de `meta_capi_queue` com esse nome de evento e marca a linha de teste em `ops_events` com `ctx.selftest = true`.
5. Se **FALHOU** (a função enfileirou o evento), grava `capi_guarda_falhou` em `ops_events` e alerta os admins in-app + push, como as outras regras.
6. **Sem lead candidato = "não aplicável", nunca falha.** Se não existir nenhum lead sem `meta_lead_id`, o teste devolve `nao_aplicavel`, registra isso e **não** alerta. No painel isso aparece em cinza como "Guarda: sem caso para testar hoje" — nunca vermelho.

O nome `GuardaSelfTest` nunca é enviado ao Meta — o worker só processa a escada real.

**Isolamento total dos contadores (garantia explícita).** Toda linha sintética nasce com `ctx.selftest = true`, e **todos** os consumidores passam a filtrar `ctx->>'selftest' IS DISTINCT FROM 'true'`:

- a regra de barramento acima de 3 em 24h (`capi_guarda_lead_recente`) no `capi-health-alert`;
- os contadores "Bloqueados (24h)" e "Bloqueio suspeito" do card;
- qualquer amostra anexada ao alerta.

Sem isso, um bloqueio sintético por dia derruba o limite de 3 sozinho em três dias. O filtro é condição de aceite do build, verificada rodando o autoteste três vezes seguidas e conferindo que os contadores continuam em zero.

No card de `/admin/ingestao`: linha **"Guarda: testada hoje ✓"** com data/hora do último autoteste; vermelho só quando o último teste **falhou** ou quando faz mais de 48h que não roda **tendo havido caso disponível**.

## Ajuste 2 · Venda vigiado por realidade, não por relógio

A comparação é sempre entre coisas comparáveis: **só ganho elegível conta**.

- **Ganho elegível** = negócio com `fase = 'ganho'` e `data_assinatura` nos últimos 7 dias (BRT) **cujo lead tem `meta_lead_id` preenchido**. Venda de lead não-Meta é barrada de propósito pela guarda — comparar contra o total de ganhos divergiria por desenho.
- **`capi_venda_sem_evento`**: dispara quando `ganhos_elegiveis > eventos_Venda + tolerância` no mesmo período — não só quando os eventos são zero. Pega a perda parcial (3 elegíveis, 1 enviado), que é o caso realista.
- **Tolerância de fila**: ganhos assinados nas últimas **6h** ficam de fora da conta do alerta (evita alarme por evento ainda em `pending`). Alerta in-app + push para admins, dedup de 24h.
- O alerta traz a lista dos negócios elegíveis sem evento correspondente, para ser acionável.
- Como a checagem passa a ser por realidade, o `Venda` **sai do alerta de silêncio por tempo** — acaba o falso positivo de hoje, que disparou só por 6h sem venda.
- Regra irmã no mesmo cheque: se um ganho elegível teve bloqueio registrado com `event_name = 'Venda'`, o alerta diz isso explicitamente — a venda existe, o evento foi barrado, e o caminho é corrigir a ingestão.
- **Data de referência com fallback (ponto cego fechado).** O gatilho `enforce_data_assinatura_ganho()` só exige `data_assinatura` quando `status = 'ativo'`, e hoje existem **6 negócios em `ganho` com o campo vazio** (de 102). Sem fallback, esses ficariam fora da janela de 7 dias e um `Venda` faltando neles nunca alertaria. A janela passa a usar `COALESCE(data_assinatura, data da mudança para 'ganho', updated_at)`, sempre em BRT — usa a assinatura quando existe, cai para o horário da virada de fase quando não existe.

No card de `/admin/ingestao`, três números lado a lado para a diferença ficar explicada em vez de parecer erro:

```text
Ganhos 7d (total)   Ganhos elegíveis (com ID Meta)   Eventos Venda 7d
        4                        ?                          5
```

## Detalhes técnicos

- **Migration 1 (DDL)**: cria `public.capi_guarda_selftest()` como `SECURITY DEFINER`, `search_path = public`, sem `GRANT` para `anon`/`authenticated` (só `service_role`, chamada pelo watchdog). Retorna `passou` / `falhou` / `nao_aplicavel`.
- **Edge function `capi-health-alert`**: chama o autoteste 1x/dia (dedup em `ops_events`); acrescenta `capi_venda_sem_evento` com o filtro de elegibilidade e a tolerância de 6h; remove `Venda` da lista `EVENTOS_ESCADA` do alerta de silêncio; adiciona o filtro `selftest` na regra de barramento.
- **Frontend**: `useCapiSaude.ts` passa a ler o último autoteste, o trio ganhos/elegíveis/eventos e a filtrar `selftest` dos bloqueios; `CapiSaudeCard.tsx` ganha as duas linhas novas.
- Nada muda em `enqueue_meta_capi_event`, no payload, nos gatilhos ou no worker de envio.

## Fora deste plano

Os conjuntos com `SCHEDULE` — já resolvidos manualmente no Gerenciador.
