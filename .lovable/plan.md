# Build A — Leva de segurança B1 (plano consolidado)

Escopo fechado nos 13 itens + verificação. Nada de webhooks (`whatsapp-webhook`, `evolution-webhook`, `receive-imovelweb-lead`), nenhum secret rotacionado.

## Descoberta crítica que muda o item 1, 2, 7 e 8

Os cron jobs do banco chamam as edge functions com a **chave anon**, não com service-role:

| Job | Função | Header hoje |
|---|---|---|
| `lead-escalation-every-minute` (1/min) | lead-escalation | `Bearer <ANON>` |
| `typesense-sync-cron` (1/min) | typesense-sync | `Bearer <ANON>` |
| `generate-monthly-executive-report` (dia 1, 10h) | generate-monthly-report | `Bearer <ANON>` |

Ou seja: colocar `requireCronAuth` nessas três **quebra o cron** se não trocarmos o header junto. Solução: reescrever os 3 jobs (`cron.unschedule` + `cron.schedule`) mandando `x-cron-secret: <CRON_SECRET>`. Como o comando carrega segredo, isso vai por **tool de insert (SQL direto)**, não pelo arquivo de migration (regra do projeto). Pré-requisito: confirmar que `CRON_SECRET` está setado (já é usado por `sync-status-to-site`); se não estiver, gerar antes.

Ordem de execução obrigatória: (a) reagendar crons com `x-cron-secret` → (b) só então deployar o guard nas funções.

## Itens EDGE

### 1) lead-escalation — sem auth
- Arquivo: `supabase/functions/lead-escalation/index.ts`.
- Mudança: `const denied = requireCronAuth(req); if (denied) return denied;` logo após o OPTIONS.
- Chamadores: cron 1/min (anon → passa a `x-cron-secret`); `cron-health-monitor` apenas **monitora** o nome, não invoca; `receive-meta-lead` só cita em comentário. Nenhum chamador de front.
- Rollback: reverter o arquivo + restaurar o job antigo com header anon.

### 2) send-push — Bearer >= 20 chars
- Arquivo: `supabase/functions/send-push/index.ts` (substituir o bloco atual das linhas 17–24).
- Chamadores confirmados, todos com `Bearer ${serviceKey}`: `lead-escalation`, `_shared/lead-notify.ts`, `receive-meta-lead` (3 pontos), `receive-landing-lead`, `receive-rdstation-lead`, `whatsapp-webhook` (não tocamos no webhook, só ele continua passando por service-role).
- **Exceção do front**: `src/hooks/usePushSubscription.ts:227` invoca `send-push` com JWT de usuário (botão de teste de push). `requireCronAuth` puro derrubaria isso.
- Guard proposto (híbrido): service-role/`x-cron-secret` passa; senão exige usuário autenticado real (`getClaims` com `role === 'authenticated'`) **e** força `user_id = claims.sub` (usuário só dispara push pra si mesmo). Anon key isolada → 401.
- Rollback: reverter arquivo.

### 3) [SISTÊMICO] getClaims aceita a anon key — 14 funções de IA
Helper novo `supabase/functions/_shared/ai-auth.ts`:
```ts
export async function requireRealUser(req: Request, opts?: { allowServiceRole?: boolean; roles?: string[] })
```
Regra: (a) se `allowServiceRole` e `requireCronAuth(req)` passa → libera; (b) rejeita se o token for igual à `SUPABASE_ANON_KEY`; (c) `getClaims` → 401 se `!claims.sub` ou `claims.role !== 'authenticated'`; (d) se `roles` informado, consulta `user_roles` com service-role e exige um dos papéis.

Análise de chamadores (evidência por grep):

| Função | Chamador | Guard |
|---|---|---|
| homi-chat | front (`HomiContext`, `HomiChat`, `HomiObjectionHelper`) | authenticated |
| homi-assistant | front (`HomiAssistant`, `HomiGerencial`, `HomiLeadAssistant`) | authenticated |
| uhome-ia-core | front (`useUhomeIa`, `RadarImoveisTab`) | authenticated + role do banco (item 4) |
| generate-corretor-report | front (`RelatorioCorretor`, `GerarManualTab`) | authenticated |
| generate-script | front (`ScriptLigacao`) | authenticated |
| oa-session-coaching | front (`SessionCoachingModal`) | authenticated |
| parse-marketing-report | front (`useMarketing`) | authenticated |
| ceo-advisor, recovery-agent, funnel-coach, checkpoint-coach, generate-followup, generate-sequence | **nenhum chamador no repo** (só `config.toml`) | authenticated (+ role no item 4); `allowServiceRole: true` por segurança, sem custo |
| generate-monthly-report | **cron mensal** (anon hoje) + `OpsEventsPanel` (front admin) | `allowServiceRole: true` + admin (item 4); cron reagendado com `x-cron-secret` |

- Rollback: os arquivos são editados só no topo; reverter arquivo por arquivo (nenhuma lógica de negócio tocada).

### 4) Role gate onde falta
Padrão de referência confirmado em `homi-ceo/index.ts` (getUser + tabela `user_roles`).
- `generate-monthly-report`: exigir `admin` (ou service-role/cron).
- `ceo-advisor`, `recovery-agent`: exigir `admin` ou `gestor` (aceitar `diretor` também, alinhado ao resto do CRM).
- `uhome-ia-core`: hoje lê `role` do **body** (`index.ts:173-177`) e usa pra montar o prompt CEO/gerente. Passa a derivar de `user_roles` via service-role; o `role` do body é ignorado. Sem papel → trata como corretor/gestor padrão, sem quebrar chamada.

### 5) homi-copilot `dossie_oferta` — IDOR
- Arquivo: `supabase/functions/homi-copilot/index.ts` (bloco linhas 27–41).
- Hoje: `getUser()` valida sessão, mas o SELECT em `pipeline_leads` por `pid` usa service-role sem checar dono.
- Mudança: incluir `corretor_id, user_id` no select e, antes de chamar a IA, exigir que o lead pertença ao usuário (`auth.uid()` ou `profiles.id` do usuário) **ou** que ele tenha `admin`/`gestor`/`diretor`. Caso contrário 403. Mantém o Mutirão funcionando (corretor sempre abre dossiê de lead que ele travou).
- Rollback: reverter arquivo.

### 6) typesense-admin — role admin/diretor
- Arquivo: `supabase/functions/typesense-admin/index.ts` (bloco 215–235). Hoje: qualquer usuário logado (anon key já é bloqueada) pode `create_collection` (que faz `DELETE /collections`) e `start_reindex`.
- Mudança: após validar o usuário, consultar `user_roles` e exigir `admin` ou `diretor` **apenas** para `create_collection` e `start_reindex`; demais ações mantidas.
- Chamador: `src/pages/AdminPanel.tsx` (tela já admin-only) — não quebra.

### 7) typesense-sync — requireCronAuth
- Único chamador: cron 1/min (anon). Depende do reagendamento com `x-cron-secret`. `typesense-admin` chama sync? verificado: usa flag interna `isSyncAuth` própria, não invoca a função.

### 8) generate-vapid — requireCronAuth + admin
- Sem chamador no repo (só `config.toml`). Aplicar `requireCronAuth` OU usuário `admin`. Uso é pontual/manual.

### 9) vitrine-public `track_event` — throttle e validação
- Arquivo: `supabase/functions/vitrine-public/index.ts` (bloco a partir da linha 387; notificação WhatsApp ao corretor na 447–480).
- Mantém público. Adiciona:
  - validação de tamanho: `lead_nome` ≤ 80 chars, `metadata` serializado ≤ 2 KB, `action`/`event_type` em allowlist;
  - cooldown por `(vitrine_id, ip_hash, event_type)`: 1 evento por 30 s e teto de 60 eventos/hora, contando em `site_events` já existentes (sem tabela nova); excedente responde `{ ok: true, throttled: true }` (200, para não sinalizar nada ao flooder) e **não** dispara WhatsApp;
  - notificação ao corretor no máximo 1 por vitrine a cada 15 min.
- Rollback: reverter arquivo.

## MIGRATION (único arquivo, 1 reload)

`supabase/migrations/<ts>_b1final_security.sql`:
1. `CREATE TABLE IF NOT EXISTS public._rollback_b1final (id, objeto, tipo, definicao, criado_em)` e **INSERT dos snapshots antes de qualquer alteração**: `pg_get_functiondef` das 9 RPCs e o resultado de `has_function_privilege('public', fn, 'EXECUTE')` / `proacl` atual de cada uma.
2. Item 10 — para cada uma das 9 (`finalizar_tentativa_v2`, `fetch_next_lead`, `fetch_next_lead_campaign`, `oferta_ativa_lock_next_lead`, `skip_oa_lead`, `aceitar_lead`, `rejeitar_lead`, `lock_lead_atomic`, `renew_lead_lock`), com assinatura completa:
   ```sql
   REVOKE EXECUTE ON FUNCTION public.<fn>(<args>) FROM PUBLIC, anon;
   GRANT  EXECUTE ON FUNCTION public.<fn>(<args>) TO authenticated, service_role;
   ```
   As assinaturas serão lidas de `pg_proc` no momento da escrita (há sobrecargas em `fetch_next_lead*`); todas as sobrecargas entram.
   Por que não quebra: front chama com JWT `authenticated` (`useOfertaAtiva`), edges chamam com service-role (`distribute-lead`, `oferta-ativa-proximo-lead`); `assert_acts_as` já dentro das funções continua sendo o guard de identidade.
- Rollback: `_rollback_b1final` guarda o ACL anterior; reverter é reaplicar `GRANT EXECUTE ... TO PUBLIC`.

Nada além disso entra na migration. O reagendamento dos 3 crons (contém segredo) vai por SQL direto, fora do arquivo de migration.

## 11) Meta Ads token — tirar do cliente

Hoje: `integration_settings` guarda `meta_ads_access_token` em texto; `MetaAdsSettings.tsx:32-37` faz `select` e joga no input; `meta-ads-sync/index.ts:153-160` lê da tabela.

Approach viável **sem rotacionar**:
- **Escrita**: nova edge `meta-ads-token-set` (admin-only) recebe o token e grava em `vault.create_secret('meta_ads_access_token', ...)` (ou `vault.update_secret`), depois substitui o valor em `integration_settings` por um placeholder `vault:meta_ads_access_token` + coluna/`key` extra `meta_ads_token_last4`.
- **Leitura de status**: RPC `public.get_meta_ads_status()` (SECURITY DEFINER, admin/diretor) retornando `{ configured: boolean, last4: text, account_id, cpl_limit, auto_sync }`. `MetaAdsSettings.tsx` deixa de ler o token; input vira write-only ("••••1234 — substituir").
- **Leitura no sync**: `meta-ads-sync` lê de `vault.decrypted_secrets` via service-role (fallback para o valor legado na tabela por 1 ciclo, para não parar o sync).
- Passo manual necessário: nenhum no dashboard Supabase — o admin só precisa **colar o token uma vez** na tela nova para migrá-lo ao Vault; depois roda um `UPDATE` limpando o valor antigo da tabela. Sinalizo que enquanto ele não recolar, o fallback legado segue ativo.
- Este item envolve migration (RPC + placeholder). Se aprovado, entra **no mesmo arquivo** de migration do item 10.

## FRONTEND

### 12) Gate de rota por papel
- `RoleProtectedRoute.tsx` está órfão (zero imports) — confirmado.
- `TabContext.tsx` **já aplica** os `roles` do `pageRegistry` (linhas 100–125, 221–287) para as rotas dentro do shell. O buraco real: `/diagnostico-rede`, `/ceo/telemetria-rede`, `/admin/ingestao`, `/admin/uso-paginas` estão em `App.tsx:111-114`, **no bloco de rotas públicas**, fora de `ProtectedRoute`.
- Mudança: mover as 4 para dentro de `<ProtectedRoute>` + `<RoleProtectedRoute allowedRoles={["admin"]}>` (revive o componente em vez de deletá-lo) e registrar as chaves com `roles: ["admin"]` no `pageRegistry`.
- Rollback: reverter `App.tsx` e `pageRegistry.ts`.

### 13) Consolidar duplicados
- `AdminPanel` renderiza em dois lugares: rota `/admin` (`pageRegistry:95/182`) e `Configuracoes.tsx:507-523` (seção `sistema`). Canônico = `/admin`; a seção "Sistema" vira card com link para `/admin` (mantém o item no menu, remove o import duplicado do `AdminPanel`).
- `/central-usuarios` já aponta para o mesmo componente `MeuTime` (`pageRegistry:111`); passa a ser `<Navigate to="/meu-time" replace />` e sai do `pageRegistry`.
- Remover `formatPhone` (dead code) em `supabase/functions/visita-public/index.ts:214`.

## VERIFICAÇÃO pedida (só diagnóstico)
`execute-sequences`, `execute-automations`, `reactivate-cold-leads`, `cron-smart-nurturing`, `homi-alerts-engine`: **não existem** em `supabase/functions/` (confirmado por listagem completa do diretório). São entradas **stale** no `config.toml`, sem função real — nenhum risco de auth aberto, só lixo de configuração. Recomendo removê-las junto do item 13 (só se você autorizar; não está no escopo declarado).

## Ordem de execução sugerida
1. Confirmar `CRON_SECRET` → reagendar os 3 crons com `x-cron-secret` (SQL direto).
2. Migration única (snapshots + item 10 [+ item 11 se aprovado]).
3. Edges: helper `ai-auth.ts`, itens 1–9.
4. Frontend: itens 12–13.
5. Validação ao vivo no preview: Mutirão (pegar lead, finalizar tentativa), push de teste, HOMI chat, relatório de corretor, vitrine pública, /admin.

Sem publish.
