# Correção do Meta CAPI (Dataset 1426170849536314)

## O que a auditoria mostrou

Consultei a fila real (`meta_capi_queue`) e o código do disparador antes de escrever este plano:

- Os eventos **em tempo real estão sendo aceitos** pelo Meta: 127 Lead, 38 Schedule, 15 ViewContent e 1 Purchase com status `sent` nos últimos dias.
- Os **1.075 eventos com falha são todos do backfill histórico** (`Invalid parameter`): 748 deles têm `event_time` de mais de 7 dias atrás — o Meta recusa qualquer evento acima dessa janela.
- O `event_time` já é gravado em **UNIX segundos** (`extract(epoch ...)::bigint`), então não existe bug de milissegundos. O problema é a idade dos eventos do backfill.
- `fn`, `ln`, `ct`, `st`, `country`, `em`, `ph` já vão com SHA-256. **Falta `zp`** e `ct`/`st` são fixos ("porto alegre"/"rs") — você optou por manter fixo.
- **Nenhum lead dos últimos 30 dias tem `fbc`/`fbp`** (0 de 1.362) e só 25 têm IP. Esse é o maior ofensor do Match Quality hoje.
- Não existe pixel de navegador neste projeto (CRM interno) — o ViewContent atual só dispara quando uma visita é marcada como realizada, por isso o Meta mostra "atualidade não disponível".

## O que será feito

### 1. Limpar o backfill rejeitado
Marcar os eventos com `event_time` acima de 7 dias como `descartado` na fila (sem reenvio), para o painel refletir só o que o Meta pode aceitar. Adicionar uma trava no enfileiramento: evento com mais de 7 dias não entra mais na fila.

### 2. Garantir atualidade dos eventos ativos
- Purchase, Schedule e ViewContent passam a usar `now()` no momento do enfileiramento (hoje o Purchase usa a data do negócio e o ViewContent do backfill usava a data da visita).
- Cron do `meta-capi-dispatch` verificado para rodar a cada minuto, de modo que o evento chegue ao Meta em segundos.

### 3. Elevar o Match Quality
- Adicionar `zp` (CEP, SHA-256) ao payload — enviado só quando existir.
- Manter `ct`/`st`/`country` fixos (porto alegre / rs / br), como você definiu.
- **Corrigir a captura de `fbc`/`fbp`**: hoje as colunas existem mas nunca são preenchidas. Os endpoints públicos de entrada de lead (`receive-landing-lead`, `receive-meta-lead`, webhook do site) passam a gravar `fbc`, `fbp`, `client_ip_address` e `client_user_agent` a partir do corpo da requisição e dos cabeçalhos.
- Reforçar a regra: se o lead tem email e telefone, os dois sempre vão hasheados (já é o comportamento, fica coberto por verificação).

### 4. ViewContent em tempo real vindo do site
Como o site fica em outro projeto, aqui entrego a ponta servidor:
- Nova edge function pública `meta-capi-track`, que recebe `{ event_name, event_id, email, telefone, fbc, fbp, url, empreendimento }`, hasheia o PII no servidor, usa `event_time = agora` e enfileira o evento com `action_source: "website"`.
- Ela captura IP e User-Agent direto dos cabeçalhos da requisição.
- Entrego junto o trecho de pixel de navegador (`fbq('track','ViewContent', {...}, {eventID})`) para colar no site, usando o **mesmo `event_id`** da chamada servidor — isso garante a deduplicação que o Meta espera.
- Painel de conexão: depois do primeiro evento `website` chegar, a "Conexão pendente" do Events Manager passa a ativa. Também rodo o `meta-capi-ping` para confirmar que o token de acesso continua válido e reporto o resultado.

## Detalhes técnicos

- Migração 1 (DDL): `enqueue_meta_capi_event` ganha parâmetros de `action_source`, `event_source_url` e `zp`, trava de 7 dias e `event_time` sempre atual para eventos vindos de trigger; `_trg_negocio_capi` e `_trg_visita_capi` passam a usar `now()`.
- Migração 2 (dados, via insert tool): marcar como `descartado` os eventos `failed` com `event_time < now() - 7 days`.
- Edge functions alteradas: `receive-landing-lead`, `receive-meta-lead` (captura fbc/fbp/IP/UA).
- Edge function nova: `supabase/functions/meta-capi-track/index.ts` (pública, validação Zod, sem segredo exposto).
- Nada muda no pipeline, roleta ou PDN.

## Validação após o build

1. Rodar `meta-capi-ping` e conferir `events_received: 1` (token válido).
2. Chamar `meta-capi-track` com um evento ViewContent de teste e conferir na fila `status=sent` em menos de 1 minuto.
3. Conferir na fila que nenhum evento novo entra com `event_time` antigo.
4. Conferir no Events Manager que a conexão da API de Conversões sai de "pendente".
