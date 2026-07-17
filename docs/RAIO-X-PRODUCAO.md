# Raio-X de Produção — uhomecrm
_Snapshot: 17/07/2026 02:45 BRT · autor: auditoria automática (somente leitura)_

> Todos os números vêm de `psql` direto no banco de produção, do linter Supabase e do scanner de segurança do Lovable, executados no momento do snapshot. Nenhum código, migration, cron ou configuração foi alterado.

---

## 1. Inventário de tabelas — uso real

Contagem total, últimos 30 dias e data do registro mais recente.

| Tabela | Total | Últimos 30d | Último registro | Status |
|---|---:|---:|---|---|
| `pipeline_leads` | **8.267** | **1.293** | 2026-07-17 02:19 | 🟢 Ativa (fluxo principal) |
| `whatsapp_mensagens` | 13.472 | **0** | **2026-06-09** | 🟡 Parada há ~5 semanas |
| `visitas` | 1.347 | 299 | 2026-07-16 22:20 | 🟢 Ativa |
| `negocios` | 277 | 80 | 2026-07-15 22:40 | 🟢 Ativa |
| `leads` | 272 | 66 | 2026-07-16 18:41 | 🟡 Duplicada com `pipeline_leads` |
| `homi_conversations` | 264 | 82 | 2026-07-16 19:02 | 🟢 Ativa (só corretor+1 gestor) |
| `lead_nurturing_state` | 246 | 95 | 2026-07-13 23:22 | 🟢 Ativa |
| `lead_nurturing_sequences` | 1.805 | **0** | **2026-04-13** | 🔴 Congelada há 3 meses |
| `reengajamento_dispatch_queue` | 10.770 | 10.770 | 2026-07-16 19:24 | 🟢 Muito ativa |
| `vitrines` | 271 | **0** | **2026-05-11** | 🔴 Sem nova vitrine há 2 meses |
| `ai_calls` | 29 | **0** | **2026-03-16** | 🔴 Abandonada |
| `automations` | 1 | 0 | 2026-03-07 | 🔴 Feature morta (ver §3) |
| `automation_logs` | **0** | 0 | — | 🔴 Feature morta |
| `distribuicao_escala` | 3 | 0 | 2026-03-09 | 🔴 Abandonada |
| `roleta_config` | 5 | 0 | 2026-05-04 | 🟡 Config estável ou esquecida |
| `referrals` | 1 | 0 | 2026-03-08 | 🔴 Feature morta |
| `pulse_events` | **0** | 0 | — | 🔴 Feature nunca usada |

Tabelas de suporte relevantes: `audit_log` 7.459 (1.283/30d), `notifications` 30.728 (10.548/30d), `oferta_ativa_leads` 15.733 (0/30d), `reengajamento_meta_disparos` 35.729 (12.497/30d), `meta_supressao` 11.217 (11.217/30d ‼ — todo estoque é dos últimos 30d), `network_telemetry` 2.274 (0/30d).

---

## 2. Edge Functions — quais realmente rodam

O repositório tem **109 pastas em `supabase/functions/`**. A única fonte de invocação registrada no banco é `ops_events` (não cobre 100% das functions — só as instrumentadas). Com esse filtro, apenas **14 funções** aparecem nos últimos 90 dias:

| Função (via `ops_events`) | Eventos 30d |
|---|---:|
| `typesense-sync` | 43.169 |
| `receive-meta-lead` | 5.027 |
| `secrets-tripwire` | 4.316 |
| `lead-escalation` | 687 |
| `whatsapp-notificacao` | 659 |
| `distribute-lead` | 237 |
| `receive-imovelweb-lead` | 208 |
| `reset-roleta-turno` | 90 |
| `edge-health-alert` | 29 |
| `stalled-deals-notify` | 4 |
| `capi-backfill` | 2 |
| `meta-leads-backfill` | 1 |
| `receive-landing-lead`, `waba_recovery_sprint_0b` | <10 |

**Cross-check independente pelos logs da Edge Runtime (últimas horas):** confirmadas rodando também `mailgun-batch-cron`, `typesense-admin`, `roleta-shift-cleanup`, `vapid-public-key`. Todas as demais (~91) **não têm prova de uso** neste snapshot — parte é código legado (`campanha-atrio-*`, `twilio-ai-*`, `elevenlabs-webhook`, `test-*`, `bootstrap-vault`, `nutricao-instance-connect`, `test-reengajamento-wave2`, `meta-templates-list`, `meta-number-quality`, `resolve-meta-forms`, `parse-marketing-report`, `ceo-advisor`, `funnel-coach`, `checkpoint-coach`, `oa-session-coaching`, `generate-monthly-report`, `generate-corretor-report`, `auto-one-on-one`, `recovery-agent`, `ia-call-result`, `homi-personalizar-mensagem`, `sync-status-to-site`, `whatsapp-360dialog`, `whatsapp-campaign-dispatch`, `voice-campaign-launcher`, `campanha-atrio-*`, `test-bridge-connection` etc.), parte é function chamada pelo frontend sem instrumentação (`homi-chat`, `homi-copilot`, `whatsapp-send`, `mailgun-send`, `imovel-og`, `vitrine-og`, `vitrine-public`, `visita-public`, `google-oauth-*`, `verificar-taxas-financiamento`).

**Ação sugerida:** habilitar `ops_events` como padrão em todas as edge functions ou dar sweep de deleção nas ~40 claramente sem uso e sem consumidor no frontend.

---

## 3. Automações genéricas (`automations`) — executor existe?

**Não existe.** Evidências:

- `automations` tem **1 linha** (`ativo=false`, `Boas-vindas ao novo lead`), congelada em 07/03/2026.
- `automation_logs`: **0 linhas** em toda a história da tabela.
- Nenhuma função Postgres referencia `automations` (`SELECT proname FROM pg_proc WHERE pg_get_functiondef(oid) ILIKE '%automations%'` → vazio).
- Nenhum trigger em `pipeline_leads`, `leads`, `visitas` ou `negocios` chama executor genérico.
- Nenhuma edge function no repositório contém a string `automations` como consumidor.
- `pg_cron` está instalada, mas o schema `cron` não é acessível para leitura via role atual — mesmo assim, se houvesse cron consumindo `automations`, ele geraria linha em `automation_logs`. Zero linhas = zero execuções.

**Conclusão: feature sem backend.** A UI de `AutomacoesPage.tsx` grava configuração numa tabela que nada consome. Todo o "automatismo" real do CRM está implementado como triggers nomeados (`trg_auto_distribute_new_lead`, `trg_nurturing_on_stage_change`, `trg_descarte_reengajamento`, `trg_cadencia_sc_stage`, `trg_visita_status_pipeline`, `trg_notify_visita_criada`, etc.) — nenhum deles lê `automations`.

---

## 4. Segurança — estado hoje

### 4.1 Scanner `supabase_lov` (15/07/2026)

5 findings, todos **WARN**:

| # | ID | Nota |
|---|---|---|
| 1 | `audit_log_atrio_no_write_policy_ok_but_review` | Informativo — comportamento correto. |
| 2 | `negocios_insert_unrestricted` | Policy INSERT em `negocios` com `WITH CHECK true` — qualquer authenticated cria negócio para qualquer corretor. |
| 3 | `profiles_broad_authenticated_read` | Policy `Authenticated can view all profiles` mantida; proteção de CPF/telefone/CRECI só via GRANT column-level (frágil). |
| 4 | `referral_leads_insert_open_anon` | INSERT aberto para anon sem validação de `referral_id` ativo. |
| 5 | `vitrine_interacoes_insert_open` | INSERT aberto para anon (esperado, mas sem validação de `vitrine_id`). |

### 4.2 Scanner `agent_security` — 5 findings

| Severidade | Item |
|---|---|
| 🔴 **ERROR** | `evolution-webhook` sem autenticação nenhuma — qualquer POST forja mensagem de WhatsApp e dispara reativação/AI-reply. |
| 🟡 WARN | `elevenlabs-webhook` sem verificação de origem (Twilio/ElevenLabs). |
| 🟡 WARN | `mailgun-webhook` sem verificação HMAC-SHA256. |
| 🟡 WARN | `whatsapp-webhook` POST sem verificação `x-hub-signature-256`. |
| 🟡 WARN | `ReportsContent.tsx` faz `document.write(report)` sem sanitização (XSS via output de IA). |

### 4.3 Supply chain

- **CRITICAL**: `html2pdf.js@0.10.1` + `jspdf@2.5.2` — Local File Inclusion / HTML Injection (GHSA-f8cm-6447-x5h2, GHSA-wfv2-pwc8-crg5).

### 4.4 Linter oficial do Postgres — 360 issues (todas categoria SECURITY)

| Regra | Nível | Quantidade |
|---|---|---:|
| `rls_enabled_no_policy` | INFO | 1 |
| `security_definer_view` | **ERROR** | 6 |
| `function_search_path_mutable` | WARN | 14 |
| `extension_in_public` | WARN | 2 |
| `permissive_rls_policy` (USING/WITH CHECK true) | WARN | 10 |
| `public_bucket_allows_listing` | WARN | 8 |
| `anon_security_definer_function_executable` | WARN | ~145 |
| `authenticated_security_definer_function_executable` | WARN | ~174 |

> Os dois últimos são artefatos de padrão do projeto: todas as `SECURITY DEFINER` da base ganharam `EXECUTE` para `anon`+`authenticated` sem revogação por função. Impacto real varia por função — cada uma precisa ser triada.

### 4.5 Comparação com o backlog de 27/05/2026 (`docs/security_backlog_27_maio_2026.md`)

| Finding antigo | Situação hoje |
|---|---|
| 🔴 `visitas_anon_token_policy_misconfiguration` | ✅ **Não aparece mais** nos scanners atuais. Corrigido. |
| 🔴 `profiles_cpf_exposed_to_all_authenticated` | 🟡 **Parcialmente mitigado**: policy segue existindo; proteção CPF/telefone/CRECI hoje é column-level GRANT. Reapareceu como `profiles_broad_authenticated_read` (WARN, não ERROR). |
| 🔴 `realtime_no_channel_authorization` | ✅ Não aparece no scanner `supabase_lov` atual. |
| 🟡 `ai_call_sessions_unscoped_full_access` | ✅ Sumiu. |
| 🟡 `lead_nurturing_state_imoveis_interesse_unscoped` | ✅ Sumiu. |
| 🟡 `lead_property_tables_unscoped_access` | ✅ Sumiu. |
| 🟡 `negocios_tarefas_atividades_unscoped_access` | ✅ Sumiu. |
| 🟡 `oportunidades_pos_vendas_unscoped_read` | ✅ Sumiu. |
| 🟡 `roleta_desbloqueios_unscoped_delete` | ✅ Sumiu. |
| ⚪ `Materialized View in API` | ✅ Não aparece. |

**Novos** desde 27/05 que exigem atenção:
- 🔴 `evolution-webhook` sem auth (ERROR).
- 🟡 `negocios_insert_unrestricted` — INSERT em `negocios` livre.
- 🟡 `referral_leads` e `vitrine_interacoes` — INSERT anon sem validação.
- 🟡 4 webhooks públicos sem HMAC (Meta WABA POST, Mailgun, ElevenLabs, Evolution).
- 🟡 XSS em ReportsContent.
- 🟡 Supply chain crítica em jspdf/html2pdf.

---

## 5. Volume de negócio

- **Corretores ativos** (`user_roles.role='corretor'`): **34**. Gestores: **4**. Diretor: 1, Backoffice: 1, RH: 1, Admin: 1.
- **Profiles**: 35 `ativo=true`, 7 `ativo=false`.
- **Leads criados em `pipeline_leads` nos últimos 30 dias: 1.293**. Por origem:

  | Origem | 30d |
  |---|---:|
  | `meta_backfill` | 745 |
  | `ig` (Instagram Ads) | 171 |
  | `Reengajamento` | 89 |
  | `Oferta Ativa` | 82 |
  | `imovelweb` | 81 |
  | `Manual` | 27 |
  | `fb` (Facebook Ads) | 22 |
  | `site_uhome` | 21 |
  | `meta_ads` | 13 |
  | `Reengajamento (Nutrição)` | 13 |
  | `(null)` | 13 |
  | `outro` | 12 |
  | `indicacao` | 3 |
  | `não informado` | 1 |

  → **Meta (ig+fb+meta_ads+meta_backfill = 951)** representa **~74%** do influxo. `RD Station` e `TikTok` têm **0** leads na base inteira.

- **Visitas últimos 30 dias**: **299** (realizada 145, no-show 106, marcada/futuras 48). Taxa no-show = **42% das concluídas**.
- **Negócios**: 10 `vendido` nos últimos 30 dias por `data_assinatura`; **36** nos últimos 90 dias; 2 em `proposta`.
- **Homi** — conversas nos últimos 30 dias por papel: **82 corretor**, **1 gestor**, **0 CEO/diretor**.

---

## 6. Integrações externas

| Integração | Configurada? | Uso recente | Saúde |
|---|---|---|---|
| **WhatsApp Evolution API** | Sim — 18 instâncias `whatsapp_instancias` | ⚠️ Última msg em `whatsapp_mensagens` = **09/06/2026**. Volume: abr 7.847 → mai 5.447 → **jun 178** → jul 0 | 🔴 12/18 instâncias `desconectado`, 6 `conectado`. Tráfego caiu ~99% |
| **WhatsApp 360dialog** | Function existe (`whatsapp-360dialog`) | Sem prova de uso | 🔴 Não invocada |
| **Meta WABA (envio de template)** | Sim | `reengajamento_meta_disparos`: 12.497/30d. `whatsapp-notificacao` 659 chamadas | 🟡 659 erros #100 "Parameter name is missing"; supressão automática Meta cresceu 11.217 em 30d |
| **Twilio (AI call)** | Functions existem | `voice_call_logs` = **0** | 🔴 Nunca usado |
| **ElevenLabs** | Secret presente | `ai_calls` parou em **16/03/2026** (29 total) | 🔴 Abandonado |
| **Mailgun** | Sim — 8 chaves em `email_settings`, domínio `uhomesales.com` | `email_campaigns`: 3 total, última **07/04/2026** | 🟡 Cron `mailgun-batch-cron` roda a cada minuto mas fila vazia |
| **Meta Ads** | Sim — captura ativa | 951 leads/30d | 🟢 Ativo (com 780 erros #100 form_name) |
| **Jetimob** | Sim | `jetimob_corretores` 35, `jetimob_processed` 3.668 (última **17/07/2026**) | 🟢 Ativo |
| **RD Station** | Function existe (`receive-rdstation-lead`) | **0 leads com origem RD** | 🔴 Nunca ingeriu |
| **TikTok** | Function existe (`receive-tiktok-lead`) | **0 leads** | 🔴 Nunca ingeriu |
| **Google Calendar OAuth** | Functions existem | `corretor_calendar_integrations`: **0 corretores conectados** | 🔴 Nunca adotado |
| **Typesense** | Cron `typesense-sync` 43.169 invocações/30d | `typesense_sync_state`: última conclusão **29/03/2026**, `total_indexed=0` | 🟡 Cron ativo mas state divergente — trabalhar ou remover |

---

## 7. Erros e saúde do sistema

### 7.1 `cron_health`
**Vazia — 0 linhas.** Infra de logging de cron nunca foi populada, embora `cron-health-monitor` esteja no repositório. O monitoramento real de cron hoje mora em `ops_events`.

### 7.2 Top erros em `ops_events` (últimos 30 dias)

| Função | Erros | Padrão dominante |
|---|---:|---|
| `receive-meta-lead` | **780** | `graph leadgen fetch #100 (form_name)` — Graph API rejeitando o campo `form_name` |
| `whatsapp-notificacao` | **659** | Meta WABA `#100 Parameter name is missing or empty` |
| `edge-health-alert` | 29 | Self-alerts do monitor |
| `receive-imovelweb-lead` | 11 | `23505` unique constraint `idx_pipeline_leads_unique_email_active` — leads duplicados |
| `lead-escalation` | 1 | — |

### 7.3 `audit_log`
7.459 linhas totais, 1.283 nos últimos 30 dias — saudável.

### 7.4 `automation_logs`
Zero linhas → confirma feature morta.

### 7.5 Cron aparentemente silencioso
- `cron-health-monitor` — grava em `cron_health` (vazia) → provavelmente nunca agendado ou desativado.
- `secrets-tripwire` — roda (4.316 execuções em 30d, todas success). ✅
- `lead-escalation` — 60 execuções/hora nos logs de runtime, todas com `escalated:0, push_sent:0` — cron vivo mas sem trabalho porque a fila de escalação não recebe candidatos.

---

## 8. Débito técnico visível nos dados

1. **Tabelas duplicadas `leads` (272 linhas) × `pipeline_leads` (8.267)** — ingestões antigas ainda gravam em `leads` (o site sincroniza via `trg_sync_site_lead_to_pipeline`). Ninguém remove `leads`.
2. **`automations` sem executor** (§3) — UI edita tabela que ninguém lê.
3. **`automation_logs`, `pulse_events`, `voice_call_logs`** — **0 linhas** nunca. Três features com schema, código e página mas sem tráfego algum.
4. **`ai_calls`, `referrals`, `distribuicao_escala`, `vitrines`** — última atividade entre março e maio. Provavelmente descontinuadas de fato mas continuam navegáveis no app.
5. **`whatsapp_mensagens` caiu 99% em 60 dias** (abr 7.847 → jun 178 → 0). 12 de 18 instâncias Evolution desconectadas. É a maior anomalia operacional deste snapshot.
6. **`lead_nurturing_sequences` congelada em 13/04/2026** mesmo com `lead_nurturing_state` recebendo dados novos (95 em 30d). O sequencer manual está ativo mas gera state, não sequences. Renomear/limpar.
7. **`typesense_sync_state`**: cron dispara 1.400×/dia mas o estado registrado é de 29/03 com `total_indexed=0`. Ou o sync não persiste progresso, ou a tabela deixou de ser fonte de verdade.
8. **`cron_health` vazia**: infra de saúde de cron foi criada mas nunca populada.
9. **Feature flags inconsistentes** em `system_flags`:
   - `campaign_dispatch_enabled=true` (13/07)
   - `nutricao_enabled=false` (13/07)
   - `campanha_atrio_enabled=false` (10/07)
   → Central de disparos está "ligada" mas nutrição e campanha Átrio estão desligadas por decisão manual. Consistente com o memo de "reengajamento parado por spam Meta", mas a flag master de campanha continua `true`, o que é confuso.
10. **`meta_supressao` cresceu 11.217 em 30 dias** — todo o estoque foi criado nos últimos 30 dias, indicando taxa alta de bloqueio pela Meta (relacionado ao dropout do WhatsApp em §5/§6).
11. **90+ edge functions sem prova de invocação nos últimos 90 dias**. Boa parte é código órfão (Twilio AI, campanha-atrio, test-*, elevenlabs-webhook, resolve-meta-forms, meta-templates-list, whatsapp-360dialog, voice-campaign-launcher, generate-*-report, checkpoint-coach, funnel-coach, ceo-advisor, auto-one-on-one, recovery-agent, sync-status-to-site, homi-personalizar-mensagem, etc.).
12. **6 views `SECURITY DEFINER`** (linter ERROR) + **~319 funções `SECURITY DEFINER`** executáveis por `anon`/`authenticated`. Explosão do padrão sem revoke seletivo.
13. **780 erros/mês em `receive-meta-lead`** por `form_name` — provavelmente formulários antigos removidos do Business Manager; a função continua tentando buscar campo inexistente. Barulho constante.
14. **Nenhum corretor conectou Google Calendar** apesar da feature estar completa (edge functions + settings UI).
15. **`ai_calls` = 29 lifetime** e **`voice_call_logs` = 0** — o subsistema de chamadas por IA nunca foi ligado em produção.

---

## Resumo executivo

- 🟢 **O CRM operacional está vivo**: pipeline (1.293 leads/30d), visitas (299/30d), negócios (10 vendas/30d, 36/90d), Homi para corretor (82 conv/30d) e Jetimob rodam normalmente.
- 🔴 **WhatsApp caiu 99% em 60 dias** e 12 de 18 instâncias Evolution estão desconectadas. Simultaneamente, `meta_supressao` acumulou 11.217 registros em 30 dias. É o item nº 1 para investigar — pode explicar boa parte dos no-shows (42%) e da queda de conversão.
- 🔴 **`evolution-webhook` está aberto sem autenticação** (ERROR do scanner). Enquanto o Evolution estiver ativo, é uma porta pública para forjar mensagens de qualquer lead.
- 🔴 **Feature "Automações" (`automations`/`automation_logs`) não tem executor** — só a UI. Ou remover a página, ou implementar o executor.
- 🟡 **1 admin apenas na base inteira** — risco de bus factor para operações que exigem role `admin`.
- 🟡 **Meta ingestão gera 780 erros/mês** por `form_name` — limpar formulários órfãos no Business Manager ou tolerar o campo ausente.
- 🟡 **Dívida de tabelas mortas visível na UI**: `automations`, `pulse_events`, `referrals`, `voice_call_logs`, `distribuicao_escala`, `vitrines` (sem uso), `ai_calls`. Definir: apaga a página ou apaga a tabela.
- 🟡 **~91 edge functions sem prova de uso.** Um sweep de deleção reduziria muito a superfície de ataque e o custo mental de manutenção.
- 🟡 **Segurança total (linter+scanners)**: 6 ERROR (5 security-definer view + evolution-webhook) + ~360 WARN. Backlog de 27/05 quase todo fechado; novos itens são principalmente webhooks públicos sem HMAC.
- 🟡 **Supply chain crítica**: `html2pdf.js` e `jspdf` desatualizados — trocar/atualizar antes do próximo build de produção.
