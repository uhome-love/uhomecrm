# Auditoria técnica completa — Uhome Sales CRM (08/09/2026)

Somente leitura. Nenhum arquivo, migration ou configuração foi alterado. Base: repositório atual (121 pastas em `supabase/functions`, 956 arquivos `.ts/.tsx` em `src`, 979 migrations) e leitura direta do banco (240 tabelas, 608 policies, 482 funções, 54 crons).

---

## 1. Arquitetura e stack

- Front: React 18 + Vite 5 + TypeScript + Tailwind + shadcn/Radix. Estado servidor em TanStack Query v5 com persistência em IndexedDB (`src/lib/queryPersist.ts`, `PersistQueryClientProvider` em `src/App.tsx`).
- Backend: Supabase (Lovable Cloud) — Postgres + RLS + Edge Functions Deno + Storage + Auth.
- Cliente único e "direto" para o host Supabase (`src/integrations/supabase/client.ts` + `src/lib/edgeBaseUrl.ts`), decisão pós-incidente de Wi-Fi (proibido reintroduzir wrappers de fetch).
- PWA com service worker manual (`public/sw.js`), kill switch (`src/lib/swKillSwitch.ts`) e polling de versão (`public/version.json`).
- Roteamento: rotas públicas declaradas em `src/App.tsx`; rotas protegidas centralizadas em `src/config/pageRegistry.ts` (chave, label, ícone, `roles`), servidas dentro de `AppLayout` com shell de abas (`src/contexts/TabContext.tsx`).
- Bibliotecas pesadas embarcadas: `mapbox-gl` + `leaflet` + `react-leaflet-cluster` (dois mapas), `jspdf` + `html2pdf.js` + `html2canvas` (dois caminhos de PDF), `@google/model-viewer`, `emoji-mart`.

## 2. Mapa de módulos e rotas

Registradas ~90 rotas protegidas em `pageRegistry.ts`. Blocos:

| Bloco | Rotas representativas | Papéis |
|---|---|---|
| Operação corretor | `/pipeline`, `/corretor`, `/agenda`, `/visitas`, `/aceite-leads`, `/corretor/call` | corretor, gestor, admin |
| Oferta Ativa | `/oferta-ativa`, `/oferta-ativa-ao-vivo`, `/placar-tv`, `/placar-do-dia` | corretor, admin |
| Gestão | `/gerente/cockpit`, `/leads-estagnados`, `/roleta/presenca`, `/foco-corretores`, `/meu-time` | gestor, diretor, admin |
| Direção/CEO | `/ceo`, `/diretora`, `/central-relatorios`, `/dados-anuncios`, `/relatorio-geral`, `/raio-x-corretor` | admin, diretor |
| Crescimento | `/central-nutricao`, `/base-leads`, `/disparador-whatsapp`, `/admin/lia-hub` | admin |
| Conteúdo | `/materiais`, `/academia`, `/imoveis`, `/scripts` | todos |
| RH/recrutamento | `/rh`, `/rh/recrutamento`, `/gerente/candidatos`, `/vaga` (público) | rh, admin |
| Admin/infra | `/admin`, `/auditoria`, `/integracao`, `/diagnostico-rede`, `/ceo/telemetria-rede`, `/admin/ingestao`, `/admin/lia` | admin |
| Públicas | `/auth`, `/visita/:token`, `/vitrine/:id`, `/imovel/:codigo`, `/indica/:codigo`, `/casatua`, `/casatuacanoas-quiz`, `/privacidade` | anônimo |

Auditoria de uso anterior (45 dias, `page_views`, 48.044 acessos / 38 usuários / 62 rotas com acesso): 5 telas concentram ~70% do uso (Pipeline, Minha Rotina, Agenda, Visitas, Aceite). Nove rotas vivas no menu tiveram zero acesso (Auditoria, Central do Gerente, Disparador WhatsApp, Import Brevo, Integração, Marketplace, Performance legado, Relatório Semanal, Relatórios 1:1).

## 3. Modelo de dados

240 tabelas em `public`. Núcleo por volume (linhas vivas):

`page_views` 119.733 · `oa_events` 90.308 · `reengajamento_eventos` 67.154 · `reengajamento_dispatch_queue` 63.965 · `pipeline_atividades` 61.951 · `notifications` 59.640 · `ops_events` 59.048 · `pipeline_tarefas` 53.458 · `pipeline_historico` 38.418 · `base_leads` 37.137 · `oferta_ativa_leads` 28.160 · `pipeline_leads` 11.149.

- Entidade central: `pipeline_leads` (115 colunas) com satélites `pipeline_tarefas`, `pipeline_atividades`, `pipeline_historico`, `pipeline_stages`, `visitas`, `negocios`.
- Identidade: `profiles.id ≠ auth.users.id`; o mapa por tabela está documentado em memória e encapsulado em `src/hooks/useCorretorIds.ts`. É a maior fonte estrutural de bug silencioso do sistema.
- Papéis em tabela separada `user_roles` + enum `app_role` (admin, gestor, corretor, backoffice, rh, diretor) e `public.has_role()` security definer — padrão correto.
- Camada canônica de métricas: views `v_kpi_*`, `v_fato_venda`, RPCs `rpc_metricas`, `rpc_perf_funil`, `get_dashboard_gerente_v4_kpis`, `get_visitas_kpis`.
- RLS: 608 policies; apenas **1 tabela pública sem RLS** (`vendas_atribuicao`) e 5 policies concedendo a `anon` (`properties`, `vitrine_interacoes`, `auth_telemetry`, `referral_leads`, `leads_legado` — as duas últimas merecem revisão).
- 36 views + 1 matview; 482 funções em `public` — número muito alto, com sobreposição (ex.: várias RPCs de reativação de reengajamento com a mesma regra de produto).

## 4. Integrações e Edge Functions

121 funções. Famílias: `lia-*` (11), `homi-*` (11), `oferta-ativa-*` (11), `meta-*` (8), `reengajamento-*` (4), `receive-*` (5 ingestões), `materiais-*` (4), `whatsapp-*` (4), `rh-vaga-*` (3), `vitrine-*`/`site-*` (5), `google-oauth-*`/`calendar-*` (4).

Integrações externas: Meta (Lead Ads, CAPI, templates, audiences, number quality), 360dialog (WhatsApp oficial da LIA), Evolution API (WhatsApp por corretor), Jetimob, RD Station, ImovelWeb, site Uhome (`src/lib/supabaseSite.ts`), Google Calendar/OAuth, Lovable AI Gateway (Gemini) e OpenAI (embeddings/áudio), Web Push (VAPID).

Aposentados mas com resíduo: Typesense (funções removidas, crons ainda ativos), Mailgun, ElevenLabs, Brevo, Marketplace.

## 5. Autenticação e perfis

- `src/hooks/useAuth.tsx` + `ProtectedRoute.tsx` (sessão) + `RoleProtectedRoute.tsx` (papéis) + `RoleHomeRedirect.tsx`/`HomeDashboard.tsx` (destino por papel).
- Backend: `requireAuth` compartilhado; funções com `verify_jwt=false` validando claims manualmente (padrão adotado por causa de 401 em preview) — funciona, mas concentra risco no código de cada função.
- Telemetria de login em `auth_telemetry` e `log-auth-event`.

## 6. Fluxos críticos

1. **Entrada de lead**: `receive-meta-lead`, `receive-landing-lead`, `receive-quiz-lead`, `receive-rdstation-lead`, `receive-imovelweb-lead`, `crm-webhook` e ponte site→CRM (`leads` + trigger `trg_sync_site_lead_to_pipeline`). Rede de segurança: cron `meta-leads-backfill` (o webhook direto nunca foi 100% confiável).
2. **Roleta**: `distribuir_lead_atomico` / `distribuir_lead_roleta`, credenciamento por janela e produto, gates (10 leads vermelhos, 100 descartes/mês), fallback manual "Fila CEO", limpeza de turno (`roleta-shift-cleanup`), log em `distribuicao_historico`.
3. **Pipeline**: 7 etapas + substatus em `flag_status`, regras centralizadas em `src/lib/leadHelpers.ts`, motor de tarefas (`taskGenerator.ts`, `qualificacaoTaskEngine.ts`, `completeLeadTask.ts`) e toque humano (`registrarToque.ts`, `ultimo_toque_at`).
4. **Visitas**: SSOT documentada; agenda inline no lead, confirmação pública por token (`/visita/:token`, `visita-public`), KPIs por criação/realização.
5. **PDN/Vendas**: `negocios` + `v_fato_venda`; VGV com rateio 50/50 e `data_assinatura` obrigatório no ganho. `/pdn` hoje redireciona para `/pipeline-negocios`.
6. **Oferta Ativa / Reengajamento**: fila fria com lock (`oferta_ativa_lock_next_lead`), mutirão ao vivo com placar, e um segundo motor de reengajamento (`reengajamento-*`, `lia-reengajar-*`) sobre `base_leads`.
7. **HOMI/LIA**: HOMI é copiloto interno com RAG (`homi_chunks`, `materiais_chunks`, cron `homi-reindex-daily`); LIA é a agente de WhatsApp da Casa Tua em caixa isolada `ia_*`/`lia_*`. LIA está viva (3.464 conversas), HOMI é uso ocasional.
8. **Marketing/CAPI**: `meta-capi-dispatch` + fila `meta_capi_queue` + guardas (`capi-health-alert`, exigência de `meta_lead_id`, `ctwa_clid` para WhatsApp).
9. **Academia/Dashboards**: trilhas/aulas/quiz com signed URLs; dashboards por papel (`CeoDashboard.tsx` 1.152 linhas, cockpit do gerente v4).

## 7. Pontos fortes

- Papéis em tabela separada com `has_role()` security definer — sem escalonamento por perfil.
- RLS praticamente universal (239/240 tabelas) e superfície `anon` muito pequena.
- Camada canônica de métricas (views/RPCs) em vez de cálculo espalhado no front.
- Concorrência de fila resolvida no banco (lock atômico) em vez de no cliente.
- Observabilidade própria real: `ops_events`, `audit_log`, `page_views`, `cron_health`, `secrets-tripwire`, `edge-health-alert`.
- Regras de negócio difíceis (VGV, BRT, equipe histórica, visitas) escritas e respeitadas.

## 8. Dívida técnica e riscos (com severidade)

| # | Item | Sev. | Evidência |
|---|---|---|---|
| 1 | Crons ativos apontando para funções inexistentes (`typesense-sync`, `typesense-admin`, `execute-automations`, `mailgun-batch-cron`, `auto-one-on-one`, `generate-monthly-report`, `homi-alerts-engine`, `jetimob-sync-catalog`) — ~1.000 chamadas/dia falhando em silêncio | Alta | `cron.job` × `supabase/functions/` |
| 2 | `vendas_atribuicao` sem RLS | Alta | `pg_tables.rowsecurity=false` |
| 3 | Dualidade `profiles.id` × `auth.users.id` sem tipo que force a distinção | Alta | `src/hooks/useCorretorIds.ts` |
| 4 | Três filas frias sobre a mesma população (`base_leads`, `oferta_ativa_leads`, `reengajamento_dispatch_queue`) com higienes diferentes → risco de falar 2× com a mesma pessoa | Alta | contagens de tabela |
| 5 | `base_leads` congelada desde 01/08 sendo declarada "fonte-mãe" | Alta | `base_leads` |
| 6 | Tipagem desligada: `src/types/supabase-client-override.d.ts` e `supabase-compat.d.ts` fazem `from()` retornar `any` | Média-alta | os dois `.d.ts` |
| 7 | 482 funções e 979 migrations sem inventário — nenhuma pessoa consegue afirmar o que está vivo | Média-alta | banco/repo |
| 8 | Arquivos gigantes: `PipelineStageTransitionPopup.tsx` 1.397, `DialingModeWithScript.tsx` 1.366, `ImoveisPage.tsx` 1.334, `CompletionForm.tsx` 1.311, `receive-meta-lead` 1.301, `whatsapp-webhook` 1.417, `reengajamento-descartados-enqueue` 1.969 | Média | `wc -l` |
| 9 | `verify_jwt=false` generalizado com validação manual por função | Média | `supabase/config.toml` |
| 10 | Tabelas de log sem retenção agressiva (`page_views` 119k, `oa_events` 90k, `notifications` 59k) | Média | `pg_stat_user_tables` |
| 11 | Policies `anon` em `referral_leads` e `leads_legado` | Média | `pg_policies` |
| 12 | Dependências duplicadas: mapbox+leaflet, jspdf+html2pdf+html2canvas | Baixa-média | `package.json` |
| 13 | 563 achados do linter Supabase pendentes (search_path mutável, security definer views) | Média | linter |

## 9. Duplicações, legado e código morto

- **Tarefas**: `pipeline_tarefas` (real) × `lead_tasks` × `negocios_tarefas`.
- **Atividades**: `pipeline_atividades` × `negocios_atividades` (origem do bug "negócio sem atividade").
- **Cadências**: `nurturing_cadencias`, `cadencia_sem_contato_passos`, `pipeline_sequencias`, `pipeline_playbooks` — três praticamente vazios.
- **Relatórios**: sete portas para o mesmo assunto (Central de Relatórios, Raio-X do Time, Raio-X do Corretor, Relatório Semanal, Performance legado, Central de Marketing, Relatórios 1:1).
- **Assistentes**: HOMI (11 funções) × LIA (11) × `uhome-ia-core` × `recovery-agent` × `ceo-advisor` × `funnel-coach` × `checkpoint-coach`.
- **Legado com resíduo**: `automations`/`automation_logs`, `pos_vendas`, `oportunidades`, `distribuicao_escala`, `whatsapp_instancias`, `campanha_atrio`, `melnick`, Typesense, Mailgun, ElevenLabs, Marketplace, Checkpoint.
- **Regra de classificação**: só ~14 das 121 funções gravam em `ops_events`; ausência de evento **não** prova ausência de uso. Nada aqui deve ser removido sem checar consumidor em (a) `functions.invoke` no `src`, (b) trigger, (c) `pg_cron`, (d) chamada entre funções.

## 10. Segurança, observabilidade e performance

- Segurança: modelo de papéis correto; RLS quase completa; pontos abertos = `vendas_atribuicao`, dois `anon` discutíveis, `verify_jwt=false` difundido, `search_path` mutável em muitas funções, segredos legados ainda cadastrados.
- Observabilidade: boa para o que está instrumentado (`ops_events`, `cron_health`, `edge-health-alert`, `capi-health-alert`, `secrets-tripwire`, telemetria de rede), cega para ~107 funções sem log padronizado.
- Performance: cache persistente + prefetch no hover do card do pipeline; gargalos remanescentes são bundle (mapas + PDF + model-viewer), telas de 1.000+ linhas e tabelas de log crescendo sem poda.

## 11. Cobertura de testes

10 arquivos de teste para 956 de código (~1%): `financiamento`, `segurosFinanciamento`, `fmtMoney`, `leadOutcome`, `taskPresets`, `routePatterns`, `lia-prompt`, `id-mapping-regression`, `ReengajamentoTables`, `example`. Não há teste de RLS, de RPC, de Edge Function nem E2E. Regras de maior risco (VGV, roleta, visitas, higiene de fila) não têm rede.

## 12. O que preservar numa migração

`pipeline_leads` e satélites com histórico integral; `user_roles` + `has_role`; camada canônica de métricas (`v_fato_venda`, `v_kpi_*`, `rpc_metricas`, `rpc_perf_funil`); roleta (`distribuir_lead_atomico`, credenciamento, gates); lock de fila da Oferta Ativa; regras BRT e equipe histórica; ingestões `receive-*` e o backfill do Meta; a caixa `lia_*` inteira; base RAG do HOMI; `ops_events`/`audit_log`.

## 13. O que refatorar

- Um tipo distinto para `ProfileId` e `AuthUserId` (remove uma classe inteira de bug).
- Quebrar os 8 arquivos acima de 1.000 linhas em módulos por responsabilidade.
- Remover os dois `.d.ts` que anulam a tipagem do Supabase e voltar aos tipos gerados.
- Consolidar tarefas e atividades em fonte única, com leitura de compatibilidade.
- Uma porta única de Performance; as outras seis redirecionam.
- Padronizar log (`ops_events`) e `requireAuth` em helper único do `_shared`.
- Retenção/partição para `page_views`, `oa_events`, `notifications`, `reengajamento_eventos`.

## 14. O que reconstruir do zero

- **Motor de fila fria** (Oferta Ativa + Reengajamento + Base Única): uma fila, uma higiene, um cooldown, um log.
- **Camada de cadências/automações**: hoje quatro mecanismos, nenhum oficial.
- **Hub de relatórios**: uma tela com definições de métrica visíveis.
- **Assistentes**: escolher LIA como agente e HOMI como copiloto, com um runtime só.
- **Dashboard CEO**: reconstruir por blocos com semântica explícita.
- Módulos a aposentar em vez de migrar: Checkpoint, Relatórios 1:1, Marketplace, chamadas por voz, e-mail marketing, coaching/conquistas, pós-venda/financeiro (praticamente sem dados).

## 15. Arquitetura proposta — UhomeSales 2.0 no Replit

```text
 Web (React 18 + Vite, PWA)      Replit Deployments (Autoscale)
        |                                  |
        +---- API tRPC/REST (Node + Fastify, TypeScript) ----+
                     |                |                |
             Domínio (pacotes)   Workers/Jobs      Webhooks
             leads | roleta      pg-boss/BullMQ    meta | 360dialog
             pipeline | visitas  (Reserved VM)     jetimob | site
             fila-fria | vgv
                     |
              Postgres gerenciado (Neon/Supabase) + Drizzle
                     |
              Storage S3-compat + Redis (locks/rate-limit)
```

Princípios: monorepo (`apps/web`, `apps/api`, `apps/worker`, `packages/domain`, `packages/db`); regra de negócio em TypeScript testável, não em 482 funções SQL; autorização em uma camada de serviço única (RLS mantida como segunda barreira); todo job em um worker com fila durável e observável, não em 54 crons soltos; um logger estruturado obrigatório em toda rota.

## 16. Migração incremental sem parar a operação

1. **Fase 0 — congelar e inventariar**: desligar crons órfãos, marcar módulos aposentados, fechar o inventário de funções por consumidor.
2. **Fase 1 — banco compartilhado**: API nova no Replit apontando para o **mesmo** Postgres. Zero migração de dados.
3. **Fase 2 — strangler por webhook**: mover primeiro as ingestões `receive-*` (idempotentes, sem UI) e rodar em sombra comparando resultados.
4. **Fase 3 — workers**: migrar crons para fila durável, um por vez, com kill switch.
5. **Fase 4 — front por rota**: as 5 telas de alto uso por último; primeiro as de baixo risco (Materiais, Academia, Relatórios).
6. **Fase 5 — auth**: manter Supabase Auth como IdP enquanto durar a coexistência; trocar só no fim, com sessões válidas nos dois lados.
7. **Fase 6 — corte**: desativar Edge Functions substituídas depois de 2 semanas de tráfego zero comprovado.

Regra durante toda a transição: nenhuma escrita duplicada nos dois mundos; a fonte de verdade é sempre o Postgres único.

## 17. Backlog priorizado

**P0**
1. Desativar os 8 crons apontando para funções inexistentes.
2. Habilitar RLS + policies em `vendas_atribuicao`.
3. Revisar as policies `anon` de `referral_leads` e `leads_legado`.
4. Atualizar ou desmarcar `base_leads` como fonte-mãe do reengajamento.

**P1**
5. Higiene única entre as três filas frias (anti-duplo-contato).
6. Padronizar `ops_events` + `requireAuth` no `_shared`.
7. Esconder do menu as 9 rotas com zero acesso.
8. Testes de regressão para VGV, roleta, visitas e higiene de fila.

**P2**
9. Tipos `ProfileId`/`AuthUserId` e remoção dos `.d.ts` que matam a tipagem.
10. Quebra dos arquivos >1.000 linhas.
11. Unificação de tarefas/atividades e da porta de Performance.
12. Retenção/partição das tabelas de log.

**P3**
13. Remover dependências duplicadas (um mapa, um PDF).
14. Aposentar Checkpoint, 1:1, Marketplace, e-mail marketing, voz, pós-venda.
15. Consolidar HOMI/LIA em um runtime.

## 18. Riscos específicos de sair de Lovable/Supabase para Replit

| Risco | Impacto | Mitigação |
|---|---|---|
| Perder RLS como rede de segurança ao mover regra para a API | Vazamento de dados entre corretores | Manter RLS ligada e rodar a API com usuário não-superuser |
| Reescrever 482 funções SQL | Divergência silenciosa de métrica (VGV, visitas) | Manter as funções canônicas no banco; migrar só orquestração |
| Auth: sessões, refresh e políticas dependem do JWT do Supabase | Logout em massa | Coexistência com Supabase Auth como IdP até o fim |
| Realtime e Storage (materiais, vídeos da Academia, signed URLs) | Quebra de Academia/Materiais | Manter Storage do Supabase mesmo com API no Replit |
| Cold start / limites do Autoscale em webhooks do Meta e 360dialog | Perda de lead e de mensagem da LIA | Webhooks em Reserved VM sempre quente + fila + backfill mantido |
| 54 crons virando jobs | Duplicidade de disparo de WhatsApp | Fila com idempotência por chave e trava global de envio |
| Perda do fluxo de deploy/preview atual | Queda de velocidade operacional | Só migrar após CI + preview equivalentes funcionando |
| Custo: hoje um provedor, depois dois durante meses | Gasto dobrado na transição | Cronograma de corte por fase com data de desligamento |

---

### Nota
Relatório diagnóstico. Números de tabela, policies, crons e funções vêm de leitura direta do banco em 08/09/2026; contagens de arquivo vêm do repositório atual. Onde não houve evidência direta, o texto aponta o que precisa ser verificado antes de qualquer remoção. Aprovar este documento significa apenas aceitar o diagnóstico — nenhuma execução está incluída.
