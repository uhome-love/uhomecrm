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
4. Limpa atrás de si: apaga qualquer linha de `meta_capi_queue` com esse nome de evento e marca a linha de teste em `ops_events` com `ctx.selftest = true` (para não contaminar o contador de bloqueios reais).
5. Se **FALHOU** (a função enfileirou o evento), grava `capi_guarda_falhou` em `ops_events` e alerta os admins in-app + push, como as outras três regras.

O nome `GuardaSelfTest` nunca é enviado ao Meta — o worker só processa a escada real.

No card de `/admin/ingestao`: linha **"Guarda: testada hoje ✓"** com data/hora do último autoteste, em vermelho se o último teste falhou ou se faz mais de 48h que não roda.

## Ajuste 2 · Venda vigiado por realidade, não por relógio

Nova regra no `capi-health-alert`, ao lado das três existentes:

- **`capi_venda_sem_evento`**: se existir negócio com `fase = 'ganho'` e `data_assinatura` dentro dos últimos 7 dias (BRT) e **nenhum** evento `Venda` na fila no mesmo período → alerta in-app + push para admins, dedup de 24h.
- Como agora a checagem é por realidade, o `Venda` **sai do alerta de silêncio por tempo** — evita alarme duplo e acaba com o falso positivo de hoje, que disparou só porque passaram 6h sem venda (o que é normal).
- Regra irmã, mais fina, no mesmo cheque: se houver ganho recente **cujo lead foi barrado pela guarda** (bloqueio registrado com `event_name = 'Venda'`), o alerta diz isso explicitamente — a venda existe, o evento foi barrado por falta de `meta_lead_id`, e o caminho é corrigir a ingestão, não o Venda.

No card de `/admin/ingestao`: contador **"Ganhos 7d × eventos Venda 7d"** lado a lado (hoje 4 × 5), que é a forma mais direta de ver a escada final saudável.

## Detalhes técnicos

- **Migration 1 (DDL)**: cria `public.capi_guarda_selftest()` como `SECURITY DEFINER`, `search_path = public`, sem `GRANT` para `anon`/`authenticated` (só `service_role`, chamada pelo watchdog).
- **Edge function `capi-health-alert`**: acrescenta a chamada do autoteste (1x/dia, controlada por dedup em `ops_events`) e a regra `capi_venda_sem_evento`; remove `Venda` da lista do alerta de silêncio por tempo.
- **Frontend**: `useCapiSaude.ts` passa a ler o último autoteste e o par ganhos×Venda; `CapiSaudeCard.tsx` ganha as duas linhas. Sem mudança de layout além disso.
- Nada muda em `enqueue_meta_capi_event`, no payload, nos gatilhos ou no worker de envio.

## Fora deste plano

Os conjuntos com `SCHEDULE` — já resolvidos manualmente no Gerenciador.
