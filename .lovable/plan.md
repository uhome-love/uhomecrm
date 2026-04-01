

# Correção Completa da Roleta — Distribuição Justa

## Problema Principal

O **advisory lock** atual não funciona. A função `distribute_lead_with_lock` adquire um lock transacional (`pg_advisory_xact_lock`), mas o lock é **liberado assim que a RPC retorna** — antes da edge function fazer a distribuição real. Isso significa que chamadas concorrentes (webhooks simultâneos) continuam com race condition.

## Bugs Restantes

### Bug A — Advisory Lock Ineficaz (CRÍTICO)
O lock transacional é liberado ao final da transação da RPC, mas a lógica de distribuição roda **depois** no edge function. Duas chamadas simultâneas passam pelo lock e leem os mesmos contadores.

### Bug B — Contagem de Segmento Incompleta no Single Path
Na linha 585, `leadEmpreendimentoMap` é construído apenas com leads do corretor atual (`todayLeads` filtrado por `corretor_id in authIds`). Leads distribuídos para corretores **fora** da janela atual não entram no mapa, fazendo com que o `resolveSegmento` na linha 587 falhe silenciosamente para esses leads — resultando em contagem por segmento menor que a real.

### Bug C — Round-Robin Não Garantido
O algoritmo atual ordena por `leadsHoje` (menor primeiro), o que é bom. Mas para leads **sem segmento** usa `leadsCountGlobal`, e para leads **com segmento** usa contagem por segmento. Um corretor pode ter 5 leads globais mas 0 de um segmento específico, e receber mais leads desse segmento enquanto outros têm 0 globais.

## Plano de Correção (4 passos)

### Passo 1 — Mover distribuição para dentro do PostgreSQL (resolve Bug A)
Substituir o advisory lock atual por uma **função RPC que faz a distribuição inteira** atomicamente no banco. Em vez de a edge function ler contadores e decidir, ela chama uma RPC que:
1. Adquire `pg_advisory_xact_lock` 
2. Conta distribuições do dia por corretor
3. Escolhe o corretor com menos leads
4. Faz o UPDATE no `pipeline_leads`
5. Insere no `distribuicao_historico`
6. Libera o lock ao commit

A edge function fica responsável apenas por notificações (WhatsApp, push, notifications).

### Passo 2 — Algoritmo de balanceamento híbrido (resolve Bug C)
Novo critério de ordenação:
```text
1º — leadsCountGlobal (total do dia, independente de segmento)
2º — leadsCountBySegment (se o lead tem segmento, desempata pelo segmento)
3º — totalAtivos (leads ativos no pipeline)
4º — lastReceivedAt (quem recebeu há mais tempo ganha)
```
Isso garante que **ninguém receba 3 leads enquanto outro tem 1**, mesmo que sejam de segmentos diferentes.

### Passo 3 — Corrigir contagem de distribuições (resolve Bug B)
Buscar `distribuicao_historico` do dia para **todos os corretores** (sem filtro de `corretor_id`), e fazer join com `pipeline_leads` para pegar o `empreendimento`. Isso garante que a contagem por segmento reflita a realidade.

### Passo 4 — Batch path usa mesma RPC
O batch dispatch também chamará a RPC sequencialmente (um lead por vez), garantindo que ambos os caminhos (single e batch) usem a **mesma lógica atômica**.

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| Nova migration SQL | Criar RPC `distribuir_lead_atomico` com lock + balanceamento + insert |
| `supabase/functions/distribute-lead/index.ts` | Simplificar: chamar RPC para distribuição, manter apenas notificações |

## Resultado

- 5 corretores + 10 leads = 2 para cada, garantido
- Sem race conditions em nenhum caminho (single ou batch)
- Contagem global sempre priorizada sobre segmento
- Lock real no banco, não no edge function

