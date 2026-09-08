# Auditoria pré-limpeza — somente leitura

Nenhum arquivo foi alterado, nenhuma migration rodada.

## 1. Baseline

| Item | Valor |
|---|---|
| SHA atual | `a2edc8a4afc68ec498e964d2ec9f284b92efddd4` |
| Data do commit | 2026-09-07T23:29:09Z ("Update plan") |
| Edge functions no repo | 120 (+ `_shared`), `supabase/functions/` |
| Cron jobs ativos | 49; inativos: 6 (`cron.job`) |

## 2. Inventário das edge functions

Evidências coletadas: (a) `rg 'functions.invoke("x")' src` → 59 nomes; (b) `pg_proc` com `functions/v1/` → 3 funções; (c) `cron.job` → 30 nomes distintos; (d) `rg 'functions/v1/' supabase/functions` → 14 nomes.

### 2.1 COM CONSUMIDOR (a)
`admin-ingestao-stats, ai-search-imoveis, calendar-create-event, calendar-disconnect, create-broker-user, cron-nurturing-sequencer, distribute-lead, extract-doc-data (src/components/pagadorias/CompradorDocUpload.tsx:124), generate-corretor-report, generate-script, gerar-intermediacao, google-oauth-callback, google-oauth-start, homi-ana, homi-assistant, homi-focus-suggestion, homi-follow-up-message, homi-personalizar-mensagem, homi-suggest-empreendimento-match, jetimob-proxy, lead-property-match, lia-brain, lia-chat, lia-custo, lia-instance-connect, lia-reengajar-arm, materiais-ingest, materiais-search, materiais-signed-read, meta-ads-sync, meta-audience-sync, meta-number-quality, meta-templates-list, nutricao-instance-connect, oa-session-coaching, oferta-ativa-cutucar, oferta-ativa-historico-reaproveitar, oferta-ativa-participantes, oferta-ativa-popular-fila, oferta-ativa-registrar-resultado, oferta-ativa-reservar, parse-marketing-report, processar-documento, reengajamento-audience-preview, reengajamento-descartados-enqueue, reengajamento-retry-falhas, resolve-meta-forms, rh-vaga-lead, send-push, site-events, sweep-descartados, sync-status-to-site, vapid-public-key, verificar-taxas-financiamento, visita-public, vitrine-bridge, vitrine-public, whatsapp-campaign-dispatch, whatsapp-notificacao`

### 2.2 COM CONSUMIDOR (b) trigger / (c) cron / (d) outra function
| Função | Consumidor |
|---|---|
| send-push | (b) `distribuir_lead_roleta`, `trigger_push_on_notification`; (d) 8 refs |
| sync-status-to-site | (b) `trigger_sync_status_to_site` |
| capi-health-alert, edge-health-alert, generate-monthly-report, homi-reindex, lead-escalation, lia-followup, lia-cron, lia-reengajar-dispatch, meta-capi-dispatch, meta-leads-backfill, meta-audience-sync, meta-ads-sync, oferta-ativa-devolucao-automatica, reengajamento-worker-tick, roleta-shift-cleanup (3 jobs), secrets-tripwire, stalled-deals-notify, sweep-descartados, auto-one-on-one, lead-property-match | (c) cron ativo |
| lia-chat, lia-webhook, lia-brain, whatsapp-ai-reply, evolution-webhook, nurturing-orchestrator, distribute-lead, whatsapp-notificacao, reengajamento-descartados-enqueue, receive-meta-lead | (d) chamadas entre functions |

### 2.3 SEM CONSUMIDOR EM (a)(b)(c)(d) — todas classificadas INCERTO
Nenhuma delas é candidata: quase todas são endpoints públicos/externos declarados em `supabase/config.toml` com `verify_jwt=false`, ou seja, o consumidor está fora do repositório (Meta, 360dialog, Jetimob, RD Station, site).

| Função | Sinal | Classificação |
|---|---|---|
| whatsapp-webhook, lia-whatsapp, crm-webhook, site-proxy, referral-public, visita-public, imovel-og, vitrine-og, receive-meta-lead, receive-landing-lead, receive-quiz-lead, receive-rdstation-lead, receive-imovelweb-lead, rh-vaga-candidato, rh-vaga-disponibilidade | `config.toml` verify_jwt=false → chamador externo | INCERTO |
| homi-chat, homi-ceo, homi-gerencial, homi-briefing, ceo-advisor, checkpoint-coach, funnel-coach, generate-sequence, recovery-agent, notify, uhome-ia-core, generate-vapid | `config.toml` verify_jwt=false; `uhome-ia-core` é falso positivo conhecido | INCERTO |
| bootstrap-vault, meta-capi-bootstrap, meta-capi-ping, log-auth-event, cron-health-monitor, roleta-fechamento-dia, jetimob-sync-corretores, lead-intelligence-insights, homi-next-task-suggestion, oferta-ativa-dossie, oferta-ativa-onboarding-counts, oferta-ativa-proximo-lead, oferta-ativa-ranking, materiais-upload-sign, test-bridge-connection, test-reengajamento-wave2 | nenhum consumidor encontrado em a/b/c/d | INCERTO |

Observação: `oferta-ativa-proximo-lead` e `oferta-ativa-ranking` não aparecem em `src/`, mas o Mutirão usa RPC (`oferta_ativa_lock_next_lead`); pode ser resíduo real — precisa de log antes de decidir.

### 2.4 Achado grave — 13 crons ATIVOS apontando para função inexistente no repo
`typesense-sync` (*/5), `typesense-admin` (*/10), `execute-automations` (*/5), `mailgun-batch-cron` (*/5), `jetimob-sync-catalog` (diário; só resta `config.toml:147`), `homi-alerts-engine` (*/30). Inativos apontando p/ inexistentes: `cron-smart-nurturing`, `reactivate-cold-leads`, `visita-amanha-enqueue`.
Ou a função está publicada sem estar versionada, ou o cron chama 404 várias vezes por minuto. Prioritário confirmar antes de qualquer limpeza.

## 3. Instrumentação (ops_events)

23 pastas de function citam `ops_events`. Padrão dominante (`supabase/functions/_shared/liaFormBridge.ts:78`):
```ts
try { await admin.from("ops_events").insert({ fn, level, category, message, ctx }); } catch (_e) {}
```
Variações: `_shared/liaAlert.ts:26-56` (com dedup), `_shared/webhook-signature.ts:47` (falha de assinatura).

Menor mudança possível (não implementar agora): criar `_shared/opsLog.ts` exportando `logOps(admin, fn, message, ctx?, level?)` com o mesmo insert try/catch, e adicionar **uma** chamada no início e uma no fim de cada handler. Custo por função: 1 import + 2 linhas. Isso transforma "sem evento" em prova real de não-uso em ~30 dias.

## 4. Rotas × dados

`src/config/pageRegistry.ts` (240 linhas) + `src/App.tsx` (202). O frontend referencia 149 tabelas via `.from("...")`.

(i) **Páginas que leem tabela vazia (0 linhas)** — 45 tabelas lidas pelo frontend estão zeradas:
`academia_trilhas, academia_quiz, academia_quiz_perguntas, academia_certificados` (Academia inteira sem conteúdo), `pulse_desafios, pulse_desafio_contribuicoes, pulse_reactions`, `referrals, referral_leads, referral_rewards, referral_config`, `pipeline_sequencias/_passos/_segmentos/_comissoes/_playbooks`, `intermediacoes, venda_comissoes, comunicacao_templates/_historico, corretor_reports, corretor_conquistas, corretor_metas_mensais, ceo_metas_mensais, empresa_metas_mensais, feriados, funnel_entries, roleta_config, roleta_segmentos, saved_scripts, team_scripts, system_flags, marketing_reports, oferta_ativa_sessoes/_templates/_reservados, integration_settings, integracao_field_mappings, lia_templates, blocked_templates, alertas_busca, checkpoint_diario, empreendimento_overrides, empreendimentos_favoritos, nurturing_cadencias, homi_memoria_usuario`.
`corretor_motivations` é falso positivo conhecido (lido em `useCorretorDailyStats.ts`).
Alerta: `roleta_config` e `feriados` vazias, mas a Core memory diz que regras de roleta e SLA dependem delas — provável fallback em código; verificar antes de mexer.

(ii) **Tabelas sem página que as leia**: `_pilot_backfill_2026_07_26`, `_rollback_andressa_2026_08_12`, `_rollback_leo_2026_08_12`, `_rollback_pos_visita_2026_08_12`, `leads_backup` (2101), `leads_legado` (2100), `pdn_entries_legado`, `melnick_campaign_analytics` (351), `melnick_metas_diarias`, `voice_call_logs`, `voice_campaigns`, `sala_reuniao_reservas`, `relatorios_1_1`, `segmento_campanhas`, `cron_health`.

## 5. 360dialog — todos os pontos

| Arquivo | Situação |
|---|---|
| `supabase/functions/lia-whatsapp/index.ts` | vivo (envio/recebimento LIA) |
| `supabase/functions/lia-chat/index.ts` | vivo |
| `supabase/functions/lia-followup/index.ts` | vivo |
| `supabase/functions/lia-reengajar-dispatch/index.ts` | vivo |
| `supabase/functions/meta-templates-list/index.ts` | vivo (lista templates) |
| `supabase/functions/_shared/liaFormBridge.ts` | vivo |
| `src/integrations/supabase/types.ts` | órfão (tipo gerado) |
| `supabase/config.toml` (`[functions.whatsapp-360dialog]`) | **órfão** — a pasta `whatsapp-360dialog` não existe |

**AdminPanel: não encontrado** — nenhuma referência a 360dialog em `src/` além de `types.ts`.

## 6. visita-whatsapp-confirm

**Não encontrado** no repositório, em `cron.job`, em `pg_proc`, em `config.toml` ou em qualquer arquivo de `src/`. Não existe cron disparando esse nome hoje, então não há falha recorrente por ela. O caso análogo real é `visita-amanha-enqueue`: removida do código e o cron foi desligado por migration (`supabase/migrations/20260719185322_*.sql:2`); hoje o job `visita-amanha-auto-2min` está `active=false`. O item prioritário de verdade é o da seção 2.4 (13 crons ativos apontando para função ausente).

## 7. Resíduos de limpezas anteriores

| Termo | Onde ainda aparece | Vivo/órfão |
|---|---|---|
| automations / execute-automations | `src/components/audit/OpsEventsPanel.tsx:38` (lista de filtro) + cron ativo `execute-automations-every-5min` | cron **vivo** apontando p/ função ausente |
| automation_logs | `src/components/audit/CriticalErrorsPanel.tsx`, `AuditStatsBar.tsx` | órfão (tabela não existe) |
| pos_vendas | `src/hooks/usePipeline.ts`, `src/test/id-mapping-regression.test.ts`, migrations | referência de etapa legada — verificar |
| oportunidades | `src/hooks/useElegibilidadeRoleta.ts`, `src/pages/PrivacidadePage.tsx`, `supabase/functions/homi-ceo`, `_shared/nurturing-email-templates.ts` | maioria é texto/label, não tabela |
| distribuicao_escala | só migrations antigas | órfão |
| whatsapp_instancias | `supabase/functions/evolution-webhook/index.ts`, `types.ts` | função sem cron/invoke → INCERTO |
| campanha_atrio | `supabase/functions/whatsapp-webhook/index.ts:472` chama `campanha-atrio-processar-resposta`, **que não existe no repo** | **quebrado em runtime** |
| whatsapp-send | nenhuma referência | limpo |
| whatsapp-360dialog | `supabase/config.toml` | órfão |
| melnick | `WhatsAppCampaignDispatcher.tsx`, `AceiteLeads.tsx`, `IntegracaoJetimob.tsx`, `lib/empreendimentos.ts`, `homi-chat`, `vitrine-public`, `vitrine-og`, `jetimob-proxy` + tabelas `melnick_*` | parcialmente vivo (nome de empreendimento), tabelas órfãs |

## 8. Riscos

Nenhuma função foi classificada como candidata a remoção nesta rodada — tudo que não tem consumidor é INCERTO. Riscos das únicas remoções plausíveis num futuro próximo:

| Alvo | O que quebra |
|---|---|
| Entradas órfãs em `config.toml` (`whatsapp-360dialog`, `jetimob-sync-catalog`) | nada em runtime; só reduz ruído. Mas se `jetimob-sync-catalog` estiver publicada e não versionada, remover a entrada pode alterar `verify_jwt` no próximo deploy |
| Crons da seção 2.4 | se a função existir publicada, desligar o cron para a sincronização de imóveis/emails. Não desligar sem antes olhar os logs de cada uma |
| `campanha-atrio-processar-resposta` (chamada em `whatsapp-webhook:472`) | já falha hoje; o `fetch` não trata erro visível — respostas de campanha Atrio se perdem silenciosamente |

## 9. Primeira mudança proposta (uma só)

**Criar o helper de log `logOps` e ligá-lo em UMA função ainda não instrumentada** — sugestão: `supabase/functions/oferta-ativa-proximo-lead/index.ts`, justamente uma das INCERTO que precisamos provar.

Arquivos tocados (2):
- `supabase/functions/_shared/opsLog.ts` (novo, ~15 linhas)
- `supabase/functions/oferta-ativa-proximo-lead/index.ts` (1 import + 1 chamada no início do handler)

Reversível: apagar o arquivo novo e a linha. Zero efeito de negócio, e em poucos dias temos prova real de uso ou não-uso — pré-requisito para qualquer remoção.
