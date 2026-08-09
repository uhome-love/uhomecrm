# Sincronização de Público do Meta (Custom Audience) a partir de segmentos do CRM

## (a) O que já existe hoje — verificado no código e no banco

**1. Custom Audience / Lookalike: não existe nada.**
Busca por `custom_audience`, `lookalike`, `adaccount`, `ads_management` nas edge functions e no `src/` não retorna nenhuma implementação. As únicas ocorrências de "audience" são de outro domínio:
- `reengajamento-audience-preview` e `reengajamento-descartados-enqueue`: "público" aqui significa a seleção de leads para disparo de WhatsApp (Base Única, descartados, listas de OA). Nada toca a Marketing API do Meta.

**2. Credenciais do Meta — são duas, separadas.**
- **CAPI**: `META_DATASET_ID` + `META_CAPI_TOKEN` (secrets de env), usados por `meta-capi-dispatch` e `meta-capi-ping`. Esse token é de Conversions API (dataset), normalmente sem `ads_management`.
- **Marketing API**: `meta-ads-sync` usa `integration_settings`, não env:
  - `meta_ads_account_id = act_901395618608094`
  - `meta_ads_access_token = "vault:meta_ads_access_token"` → o valor real vem do Vault via `public.get_meta_ads_token_internal()` (SECURITY DEFINER, só service_role).
  - `meta_ads_sync_user_id` para posse das linhas no cron.
- Não há `business_id` configurado em lugar nenhum.
- **Escopo não verificável sem chamar o Meta**: hoje esse token só é exercido em leitura (`/campaigns`, insights). Criar Custom Audience exige `ads_management` (e o usuário precisa ter aceito os Termos de Público Personalizado na conta). Isso vira o primeiro passo do build: um `debug_token` / `GET act_.../customaudiences` para provar o escopo antes de escrever qualquer código de criação.

**3. Hash reaproveitável: sim.**
- `_capi_sha256_norm(text)` → `sha256(lower(btrim(unaccent(x))))` — serve para e-mail, cidade, nome.
- `_capi_normalize_phone(text)` → só dígitos; combinado com `_capi_sha256` dá o `PHONE` no formato que o Meta espera (E.164 sem `+`, com DDI 55).
- Ressalva: o Meta espera e-mail em minúsculas **sem** remover acento de forma agressiva; na prática `unaccent` em e-mail é inofensivo (e-mails válidos são ASCII), mas o payload de e-mail usará `_capi_sha256` (sem unaccent) para bater 1:1 com a norma do Meta, e `_capi_sha256_norm` só para campos de texto livre.

**4. Opt-out: sim, dá para excluir.**
`meta_supressao` tem 11.772 linhas, com `telefone`, `telefone_last8`, `codigo`, `motivo`, `suprimir_ate`. A exclusão será por `telefone_last8` (mesmo casamento já usado no reengajamento) considerando `suprimir_ate` nulo ou futuro.

Base disponível: `pipeline_leads` tem 9.398 linhas, 8.872 com e-mail e 9.356 com telefone.

## (b) Desenho proposto

### Definição de segmento
Três fontes, na mesma chamada, resolvidas por um único RPC:
1. **Segmento nomeado** (recomendado como padrão): definições declarativas guardadas na nova tabela, por exemplo `compradores` (leads com negócio ganho), `qualificados`, `por_empreendimento`. O filtro fica em SQL dentro de um RPC `public.rpc_meta_audience_membros(_segmento jsonb)`, não em string SQL vinda do cliente.
2. **Filtro estruturado** (jsonb): `{ empreendimento_ids, stage_ids, ganho: true, periodo }` — mesmo vocabulário que o reengajamento já usa, sem SQL livre.
3. **Lista explícita de `pipeline_leads.id`**.

Não reusar `custom_lists.filtros`: é um blob por corretor, sem contrato estável, e misturaria escopo de prospecção com mídia paga.

Regras de elegibilidade sempre aplicadas no RPC: exclui opt-out (`meta_supressao` ativo por `telefone_last8`), exclui leads sem e-mail e sem telefone, exclui inativados/arquivados, e deduplica por telefone.

### Fluxo da edge function `meta-audience-sync`
1. Auth: JWT de admin/CEO **ou** `x-cron-secret` (mesmo padrão de `meta-ads-sync`).
2. Chama o RPC, que devolve **já hasheado** (`_capi_sha256` / `_capi_normalize_phone` + `_capi_sha256`). PII em claro nunca sai do banco.
3. Busca o token do Vault via `get_meta_ads_token_internal()`.
4. Se o segmento ainda não tem `meta_custom_audience_id`: `POST act_.../customaudiences` com `subtype=CUSTOM`, `customer_file_source=BOTH_USER_AND_PARTNER_PROVIDED`. Senão, reusa o id.
5. Envia os membros em lotes de até 10.000 via `POST /{audience_id}/users`, com `schema: ["EMAIL","PHONE"]`, `data` já em SHA-256, e `session` (`session_id`, `batch_seq`, `last_batch_flag`) para o Meta contar o upload corretamente.
6. Grava resultado (contagens, `num_received`, `num_invalid_entries`, erro) em `meta_audience_runs`.
7. Modo `dry_run` (padrão no primeiro uso): calcula tudo e não chama o Meta.

### Arquivos, tabelas e secrets — escopo estrito

Criar:
- `supabase/functions/meta-audience-sync/index.ts` (validação Zod, CORS, batch, dry_run).
- Migração DDL:
  - `public.meta_audiences` (id, chave do segmento, nome, `definicao jsonb`, `meta_custom_audience_id`, `ad_account_id`, `ultima_sync_at`, contadores, timestamps) + GRANTs + RLS (leitura para `authenticated` com papel admin/gestor, escrita só `service_role`).
  - `public.meta_audience_runs` (histórico por execução: enviados, recebidos, inválidos, erro, duração) + GRANTs + RLS equivalentes.
  - `public.rpc_meta_audience_membros(_definicao jsonb, _limit int, _offset int)` — SECURITY DEFINER, retorna só hashes.
- Página/aba de UI (opcional, fase 2): card em Configurações → Marketing listando públicos, contagem e botão "Sincronizar", reusando o padrão de `MetaAdsSettings`.

Alterar:
- `supabase/config.toml`: **nada** — a função exige JWT ou cron secret, validado em código.
- `supabase/functions/secrets-tripwire/expected.json`: só se um secret novo entrar.

Secrets: **nenhum novo**, se o token de `meta_ads_access_token` (Vault) tiver `ads_management`. Se não tiver, entra um `META_ADS_MANAGEMENT_TOKEN` que você gera e adiciona em Project Settings → Secrets.

Nada muda em pipeline, roleta, PDN, CAPI ou reengajamento.

### Fases
- **Fase 0 (leitura)**: provar escopo do token (`debug_token` + `GET customaudiences`) e reportar. Sem escrita.
- **Fase 1**: migração (tabelas + RPC) e a função em `dry_run`; devolvo contagem por segmento para você conferir antes de qualquer upload.
- **Fase 2**: upload real de um segmento semente e conferência no Events Manager / Audiences.
- **Fase 3**: UI e agendamento (cron diário opcional).

## (c) Riscos e pré-requisitos

- **Escopo do token** é o bloqueio principal. Sem `ads_management` e sem os Termos de Público Personalizado aceitos na `act_901395618608094`, a criação falha com erro de permissão — por isso a Fase 0 é só leitura.
- **Tamanho mínimo**: o Meta exige ~100 correspondências para o público ficar utilizável e ~1.000 para lookalike de qualidade. Segmentos como "compradores" podem ficar abaixo disso; o dry_run mostra isso antes.
- **LGPD**: o hash ocorre no banco; a edge function nunca vê e-mail ou telefone em claro, e os hashes não são persistidos.
- **Opt-out** é por telefone; lead que só tem e-mail não é coberto pela `meta_supressao` — a definição do segmento deve tratar isso explicitamente.
- **Orçamento de migrations**: 1 migration DDL, dentro da regra de no máximo 2/dia em horário comercial.
- **Sem `business_id`** configurado: se o público precisar ser compartilhado entre contas, isso vira configuração extra.
