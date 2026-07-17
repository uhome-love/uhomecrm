# Domínio 1 — Pipeline / Funil de Vendas

> **Coração operacional do CRM.** Toda ação de corretor gira em torno do pipeline_leads e seus artefatos (tarefas, atividades, histórico, comissões).

---

## 1. Propósito de negócio

Gerenciar o ciclo de vida de um lead comercial desde a chegada até o fechamento do contrato, num funil único com 7 etapas ativas. É o registro central do que cada corretor está fazendo, o que o gestor vê, e a base de todos os relatórios de performance e forecast.

---

## 2. Tabelas envolvidas

### `pipeline_leads` (94 colunas — a mais gorda do sistema)
Colunas-chave por bloco:

| Bloco | Colunas |
|---|---|
| **Identidade** | `id`, `nome`, `telefone`, `telefone2`, `telefone_normalizado`, `email` |
| **Estágio** | `stage_id` (FK `pipeline_stages.id`), `stage_changed_at`, `ordem_no_stage`, `flag_status` (jsonb — substatus por etapa: `status_atendimento`, `status_visita`, `status_negociacao`, `status_contrato`, `prazo`) |
| **Atribuição** | `corretor_id`, `gerente_id`, `distribuido_em`, `aceito_em`, `aceite_expira_em`, `aceite_status` (`pendente`\|`aceito`\|`rejeitado`\|`descartado`), `motivo_rejeicao`, `is_redistribuicao`, `corretor_anterior_id` |
| **Origem/Marketing** | `origem`, `origem_detalhe`, `campanha`, `campanha_id`, `conjunto_anuncio`, `anuncio`, `formulario`, `plataforma`, `meta_lead_id`, `jetimob_lead_id`, `dados_site` (jsonb), `capi_enviado_at` |
| **Segmentação** | `segmento_id`, `produto_id`, `empreendimento`, `imovel_codigo`, `imovel_url` |
| **Scoring/IA** | `lead_score`, `lead_score_at`, `lead_temperatura`, `temperatura`, `complexidade_score`, `oportunidade_score`, `nivel_interesse`, `prioridade_lead`, `ai_replied` |
| **Radar imóvel** | `radar_quartos`, `radar_valor_max`, `radar_tipologia`, `radar_bairros[]`, `radar_status_imovel`, `radar_atualizado_em` |
| **Estagnação/Reciclagem** | `estagnado`, `estagnado_em`, `estagnado_aviso_em`, `estagnado_prazo_em`, `estagnado_aviso2_em`, `reciclagem_aviso_at`, `ultima_acao_at` |
| **Descarte/Reengajamento** | `arquivado`, `motivo_descarte`, `tipo_descarte`, `reengajamento_status`, `reengajamento_enviado_at`, `reengajamento_wave2_at`, `reativado_por_nutricao`, `reativado_em`, `visita_amanha_resposta` |
| **Escalação** | `escalation_level`, `last_escalation_at` |
| **WhatsApp** | `conversation_window_until` (janela 24h Meta), `modo_conducao` |
| **Dedup** | `dedup_grupo_id`, `requer_revisao_dedup` |
| **Negócio linkado** | `negocio_id` (FK negocios.id) |

**Índices únicos parciais críticos:**
```sql
idx_pipeline_leads_unique_email_active
  UNIQUE (lower(email)) WHERE email IS NOT NULL AND aceite_status <> 'descartado'

idx_pipeline_leads_unique_phone_active
  UNIQUE (telefone_normalizado) WHERE telefone_normalizado IS NOT NULL AND aceite_status <> 'descartado'

idx_pipeline_leads_jetimob_unique
  UNIQUE (jetimob_lead_id) WHERE jetimob_lead_id IS NOT NULL
```
Ou seja: **um lead descartado libera email/telefone para reentrada** — é intencional (reengajamento reconta como novo lead ativo).

### `pipeline_stages`
23 linhas totais, mas só 7 ATIVAS + 2 auxiliares no board de leads:

Ativas (`ativo=true`, `pipeline_tipo='leads'`, ordenadas):
| ordem | nome | tipo |
|---|---|---|
| 0 | Novo Lead | novo_lead |
| 1 | Sem Contato | sem_contato |
| 2 | Qualificação | qualificacao |
| 3 | Aquecimento | aquecimento |
| 4 | Visita | visita |
| 5 | Em Negociação | proposta |
| 6 | Contrato | contrato_gerado |
| 7 | Ganho | venda |
| 11 | Caiu | caiu |
| 12 | Descarte | descarte |
| 20 | Aprovação / Documentação | documentacao *(vestígio, quase não usado)* |

Além disso há um pipeline paralelo `pipeline_tipo='pos_vendas'` (Envio Oportunidades, Boas-vindas, Bem-estar, Indicações) e stages `ativo=false` de uma versão antiga do funil (Contato Iniciado, Busca, Pós-Visita, Visita Marcada, Visita Realizada, Possível Visita, Negócio). **Não excluídos — cuidado ao renomear/mexer no schema.**

### `pipeline_tarefas`
- Colunas: `id, pipeline_lead_id, titulo, descricao, prioridade, status, responsavel_id, vence_em, hora_vencimento, concluida_em, tipo, origem`
- **Cap de 30 dias no vencimento** via trigger `trg_pipeline_tarefas_cap_30d` — não deixa criar tarefa com vence_em > hoje+30d.

### `pipeline_atividades`
Timeline de tudo que acontece no lead. `tipo` inclui: `nurturing_sequencia`, `whatsapp`, `ligacao`, `email`, `visita`, etc. Também colunas `tipo_contato`, `resultado`.

### `pipeline_historico`
Log imutável de troca de stage: `stage_anterior_id`, `stage_novo_id`, `movido_por`, `observacao`.

### `pipeline_comissoes` / `venda_comissoes` / `comissao_faixas`
Divisão de comissão por corretor no fechamento. `pipeline_comissoes` liga direto ao lead; `venda_comissoes` liga ao `negocios`.

### Playbooks e sequências (backend-lite)
- `pipeline_playbooks` + `pipeline_playbook_tarefas`: template de tarefas por estágio, disparado pela função `trg_pipeline_playbook_on_stage_change`.
- `pipeline_sequencias` + `pipeline_sequencia_passos` + `pipeline_lead_sequencias`: cadência linear por lead. Funciona mas pouco usada.
- `pipeline_segmentos`, `pipeline_produtos`, `pipeline_materiais`, `pipeline_parcerias`, `pipeline_anotacoes`, `pipeline_estagnacao_config`.

### RLS
- `pipeline_leads`: 8 policies — corretor vê os próprios, gestor vê da sua equipe (via `team_members`), admin vê tudo, diretor lê tudo (via `has_role`), parceiro vê os que estão em `pipeline_parcerias`.
- `pipeline_tarefas` / `pipeline_atividades`: policies duplicadas (herança de refatorações) — o padrão `_scoped/_admin_all/_gestor_team_write` é o mais novo, mas as antigas `Corretores can *` continuam ativas. **Débito técnico.**
- `pipeline_stages`: leitura para todo autenticado, write só admin.
- `pipeline_historico`: insert e select amplos (todo authenticated).

---

## 3. Fluxo de dados ponta a ponta

```
[Meta Ads webhook] ─┐
[Site uhomesales]   │
[ImovelWeb]         ├─► receive-*-lead (Edge) ─► INSERT pipeline_leads
[RD Station]        │      │
[TikTok]            │      ▼
[Manual /pipeline]  │   trg_normalize_phone (BEFORE)
                    │   trg_auto_tag_campaign (BEFORE)
                    │   trg_pipeline_leads_default_stage (BEFORE)
                    │   trg_calcular_complexidade (BEFORE)
                    │   trg_calcular_oportunidade (BEFORE)
                    │   trg_auto_distribute_new_lead (BEFORE) ─► roleta_fila / distribuicao_escala
                    │   auto_archive_reengaj_descartado (BEFORE)
                    ▼
             pipeline_leads (row criada)
                    │
                    ├── AFTER INSERT: trg_cadencia_sc_stage (cria tarefas Sem Contato)
                    ├── AFTER INSERT: trg_notify_pipeline_lead_changes
                    │
   [corretor aceita/rejeita via UI PipelineKanban]
                    │
                    ▼
   UPDATE aceite_status  ─► trg_sync_aceite_status_to_distribuicao
                    │      trg_fix_aceite_on_corretor_assign
                    ▼
   [mover para próximo stage — drag&drop no Kanban]
                    │
                    ▼
   UPDATE stage_id  ─► trg_nurturing_on_stage_change  (pausa/muda cadência)
                     ─► trg_cancel_tasks_on_lead_close (se stage é terminal)
                     ─► trg_descarte_reengajamento (se stage=descarte)
                     ─► trg_track_temperatura
                     ─► INSERT pipeline_historico (via app + on_pipeline_lead_status_changed)
                     ─► trg_cleanup_desatualizado_on_venda (se venda)
                    │
                    ▼
   [visita registrada]  ─► visitas.status='realizada'
                          ─► trg_visita_status_pipeline (move lead p/ "Em Negociação")
                          ─► trg_lead_to_negocio_on_visita_realizada (cria row em negocios)
                    │
                    ▼
   [venda]  UPDATE negocios.fase='vendido' + data_assinatura
            ─► trg_sync_lead_stage_on_venda (move lead p/ Ganho)
            ─► trg_negocio_fase_changed (histórico)
```

Cadência "Sem Contato" (48/72h reciclagem): triggers `trg_cadencia_sc_stage` e `trg_cadencia_sc_avancar_acao` mantêm tarefas rolando enquanto o lead não sai do stage.

---

## 4. Componentes e hooks principais do frontend

**Páginas**
- `src/pages/PipelineLeads` (via `App.tsx`) — Kanban principal
- `src/pages/CorretorDashboard.tsx` — visão diária do corretor com bucket de tarefas
- `src/pages/GerenteDashboard.tsx` — visão do gestor

**Componentes-chave em `src/components/pipeline/`**
- Kanban com colunas por stage, drag-and-drop, filtros avançados
- `LeadDetail*` — drawer "tudo no lead" (diretriz de design: qualquer ação operacional acontece dentro dele)
- Substatus por etapa em `flag_status`, UI centralizada em `src/lib/leadHelpers.ts`

**Hooks principais**
- `useKPIs`, `useCorretorKpisCarteira`, `useCorretorKpisConquistas`
- `useLeadIntelligence`, `useLeadProgression`, `useLeadPropertyMatches`
- `usePipelineEstagnacao`, `useLeadsParados`, `useEstagnadoLeadDrawer`
- `useNegocios`, `useNegociosCount`, `useNegocioActions` (transição lead→negócio)
- `useLeadOutcome`, `visitaResultadoRouting` — routing pós-visita
- `useTarefasHoje`, `taskGenerator`, `taskGrouping`, `taskScheduling`, `taskBuckets`

**Libs de regra**
- `src/lib/leadHelpers.ts`, `leadOutcome.ts`, `leadScoring.ts`, `leadQualidade.ts`, `leadUtils.ts`
- `src/lib/pipelineAudit.ts`, `pipelineSortOrder.ts`, `pipelineTelemetry.ts`
- `src/lib/visitaResultadoRouting.ts` (mapeia resultado de visita → stage)
- `src/lib/negocioQueda.ts`

---

## 5. Edge Functions envolvidas

| Function | Faz |
|---|---|
| `distribute-lead` | Chama roleta ou distribuicao_escala e retorna `corretor_id`. Usada pelo trigger via `pg_net` e por endpoints manuais. |
| `lead-escalation` | Move de nível de escalação quando `escalation_level` avança (usa `last_escalation_at`). |
| `lead-intelligence-insights` | Gera JSON de "inteligência" (perfil + próxima ação) via IA e grava em `pipeline_leads.dados_site` / `homi_alerts`. |
| `lead-property-match` | Busca imóveis compatíveis com o `radar_*` e grava em `lead_imoveis_indicados`. |
| `funnel-coach` | Sugestões de próxima ação por lead. |
| `generate-followup` | Gera mensagem de follow-up (chamada pela UI). |
| `stalled-deals-notify` | Cron — notifica gestores sobre negocios parados. |

---

## 6. Regras de negócio não óbvias

- **Cap de 30 dias em tarefas** (`trg_pipeline_tarefas_cap_30d`) — trava vencimento; a intenção é forçar próxima ação curta.
- **Índice UNIQUE ignora descartados** — mesmo email/telefone pode voltar como novo lead se o anterior foi descartado. É *feature*, não bug (habilita reengajamento).
- **Roleta usa `roleta_campanhas` como fonte de verdade de segmento**, nunca `pipeline_leads.segmento_id` (ver `mem://features/roleta/segment-resolution-source-of-truth`).
- **Aceite tem sentinela de 60s** de "grace period" para evitar race na UI.
- **`ordem_no_stage`** é usada pelo Kanban para ordenação drag&drop dentro da coluna; o `ScoreBadge` no card mostra `lead_score` + `lead_temperatura`.
- **Substatus por etapa em `flag_status` jsonb**, não em colunas — a chave muda por stage: `status_atendimento` (Qualificação), `prazo` (Aquecimento, 30/60/90), `status_visita` (Visita), `status_negociacao`, `status_contrato`.
- **Ganho não é coluna do board.** O botão "🏆 Ganhos" filtra por `stage_id` de Ganho — visão só-leitura. Se admin quiser reativar, existe botão "Reativar lead" no modal.
- **Auto-archive Descarte 24h** (cron) — inativa `arquivado=true`, mas mantém elegível para oferta ativa/nutrição.
- **Playbook fica atrás de `trg_pipeline_playbook_on_stage_change`** — se a stage muda e existe playbook associado, tarefas são criadas em batch.
- Só 1 automação existe no sistema (`Boas-vindas ao novo lead`, `is_active=false`, `run_count=0`), e `automation_logs` tem 0 linhas.

---

## 7. Decisões de design encontradas em comentários/commits

Do memory index e código:
- Diretriz "**Tudo no Lead**": "All operational actions stay within the Lead Detail drawer" (mem://features/pipeline/diretriz-detalhe-lead-360). Motivo: reduzir salto de contexto do corretor.
- Pipeline é **fluxo único**: mem://features/pipeline/negocio-como-etapas-pipeline — "Ganho NÃO é coluna: fica em filtro/toggle no header".
- `Segmentos canônicos (4)`: S1 Moradia / S2 Investimento / S3 Alto Padrão / S4 MCMV — alinhados pipeline↔roleta.
- `Sem Contato Recycling v2`: cutoff 72h, WhatsApp out counts, pré-aviso 12h — mem://features/pipeline/reciclagem-48h-sem-contato.
- `Advanced Filters Logic v2`: cross-check com visitas.
- Migrations regras 18/05/2026: máx 2/dia 08-19h BRT (força reload PostgREST → flap UI).

---

## 8. Dependências com outros domínios

**Consome de:**
- `aquisicao-leads` (receive-* + roleta) — origem de todos os leads
- `visitas` — status de visita puxa/atualiza stage
- `comunicacao` — mensagens WhatsApp/email logadas em `pipeline_atividades`
- `nutricao-reengajamento` — cadências criam tarefas e reativações
- `homi-ia` — insights, sugestões, scoring
- `imoveis-produto` — radar_* filtra catálogo

**Produz para:**
- `pos-venda-financeiro` — via `negocio_id` e `venda`
- `gestao-lideranca` — KPIs, forecast, ranking
- `gamificacao-cultura` — conquistas por atividade
- `marketing` — funil de conversão por campanha

---

## 9. Perguntas em aberto para o fundador

1. As 9 stages `ativo=false` (`Contato Iniciado`, `Busca`, `Pós-Visita`, `Visita Marcada`, `Visita Realizada`, `Possível Visita`, `Negócio`) — são de uma versão antiga do funil ou têm uso escondido? Podem ser deletadas?
2. `pipeline_tipo='pos_vendas'` (4 stages) — realmente há um pipeline paralelo de pós-vendas em uso, ou é rascunho?
3. Cap de 30 dias em tarefas: é dogma ou dá para relaxar para tarefas de nutrição longa?
4. `pipeline_playbooks` — só 1 playbook ativo? Todos os stages deveriam ter playbook?
5. `pipeline_sequencias` vs `nurturing_cadencias` vs `automations` — existem 3 mecanismos concorrentes de "sequência". Qual é o oficial em 2026? Por que os outros dois não foram deletados?
6. Stage "Aprovação / Documentação" (ordem 20, ativo=true) — está entre as ativas mas ordem fora do fluxo 0-7. Fantasma ou usado em algum override?
7. Campos `modo_conducao`, `tipo_acao`, `prioridade_acao`, `modulo_atual` — todos existem mas parecem vazios; para que foram criados?
8. `is_redistribuicao` + `motivo_redistribuicao` + `corretor_anterior_id`: fluxo formal de reatribuição ou só telemetria?
