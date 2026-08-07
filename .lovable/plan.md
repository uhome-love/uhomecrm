# Reestruturação Comercial — Gestão por Atividade (Ondas 1 → 4)

Plano único. Onda 1 detalhada em passos de 1 build. Ondas 2–4 em blocos.

---

## 1. Diagnóstico — estado real do código (verificado agora)

### `ultimo_toque_at`
- **Grava:** `src/lib/registrarToque.ts`, chamado em 8 pontos — `completeLeadTask.ts`, `taskCompletion.ts`, `visitaResultadoRouting.ts`, `VisitaCompletionFlow.tsx`, `FocusModeModal.tsx`, `WhatsAppFocusFlow.tsx`, `WhatsAppTemplatesDialog.tsx`, `QuickActionMenu.tsx`.
- **Lê:** ninguém. Zero leitura no frontend, zero em funções do banco, zero em edge functions.
- **Não grava (buraco real):** `usePipelineLeadData.addAtividade` e `addAnotacao` sobem só `ultima_acao_at` — ou seja, atividade criada pela aba do lead **não** conta como toque hoje.
- **Dados:** 9.278 leads com `ultimo_toque_at` preenchido (backfill ok); 1.876 leads ativos.
- **Não é selecionado** pelo Kanban: o `selectFields` de `src/hooks/usePipeline.ts` (linha 282) traz `ultima_acao_at` mas **não** `ultimo_toque_at`. Precisa entrar na lista.

### Card e saúde hoje
- Card: `src/components/pipeline/CardMinimal.tsx` (600 linhas). A cor é 100% tarefa: `resolveStatus()` → `SIDEBAR_BY_STATUS` (vermelho atrasada / verde hoje-futura / âmbar **sem tarefa** / sky convertido / zinc descarte).
- Atalho de check ✅ existe só quando há tarefa hoje/atrasada (`canQuickComplete`), abrindo `TaskCompletionDialog` → `completeLeadTask()`.
- Motor de conclusão: `src/lib/completeLeadTask.ts` (grava `pipeline_atividades`, sobe `ultima_acao_at`, chama `registrarToque`, trata outcome/stage/descarte) e `src/lib/taskCompletion.ts` (variante de 278 linhas usada na Central de Tarefas). **Duas implementações do mesmo fluxo** — armadilha conhecida.
- Filtros/pílulas do board: `PipelineFiltroBadges.tsx` já tem a pílula `sem_tarefa`; classificação central em `src/lib/taskQueryUtils.ts` (`getLeadStatusFilter`), consumida também por `PipelineManagerActions.tsx` ("Leads sem tarefa") e `calcGestorOwnRow.ts`.
- Ordenação: `src/lib/pipelineSortOrder.ts`, buckets por tarefa (atrasada/hoje/futura/sem).

### Estagnação
- Fonte hoje: `public._pipeline_referencia_estagnacao(lead)` = GREATEST(`_pipeline_ultima_acao_humana`, tarefa vencida). `_pipeline_ultima_acao_humana` é um GREATEST largo: `stage_changed_at`, `created_at`, `aceito_em`, atividades, anotações, tarefas concluídas, WhatsApp enviado, visitas. **Não** usa `ultimo_toque_at`.
- Config: `pipeline_estagnacao_config` tem **2 linhas ativas** — Qualificação 15d e Aquecimento 30d. Ou seja, o motor **já está ligado** hoje: **345 leads com `estagnado = true`**.
- Consumidores: `get_pipeline_estagnacao()`, `processar_estagnacao_pipeline()`, `decidir_lead_estagnado()`, `usePipelineEstagnacao.ts`, `useEstagnadoLeadDrawer.ts`, `/leads-estagnados`, `EstagnacaoStatusCard.tsx`.

### Termômetro / score
- Duas escalas convivendo: `pipeline_leads.temperatura` (texto) e `oportunidade_score` (0–100) com rótulos em `src/lib/scoreTemperatureLabels.ts`. Ambos aparecem em `PipelineLeadDetail`, `MissionBriefingDrawer`, `HomiLeadAssistant`, `PipelineSortDropdown`, `PipelineAdvancedFilters`. **O CardMinimal não mostra nenhum dos dois** — a duplicação está no drawer/listas, não no card.

### Nutrição e subfunil
- Nutrição: `/central-nutricao` (`CentralNutricao.tsx` + `components/nutricao/*`) — manual, com gate `system_flags.campaign_dispatch_enabled`. Existe também `lead_nurturing_sequences` / `lead_nurturing_state` (motor antigo). Duas camadas, ainda não reconciliadas.
- Subfunil de Qualificação: **não existe** como board arrastável. O que existe é `flag_status.status_atendimento` editado por `LeadFlagControls.tsx` / `QualificacaoChecklistCard.tsx`.

### Números que sustentam a virada
- 2.740 tarefas canceladas nos últimos 30 dias; 1.853 tarefas pendentes para 1.876 leads ativos.

---

## 2. Conflitos e armadilhas

1. **A estagnação já está ligada** (Qualificação 15d / Aquecimento 30d, 345 leads). O plano fala em "ligar faseado" — na prática é **migrar a fonte** de uma máquina em produção, sem reprocessar retroativo.
2. **`registrarToque` tem furo**: atividades e anotações criadas pela aba do lead não sobem `ultimo_toque_at`. Se ligarmos a cor por toque antes de tapar isso, cards ficam vermelhos indevidamente. **Corrigir no Passo 1.**
3. **Dois motores de conclusão** (`completeLeadTask.ts` e `taskCompletion.ts`). "Registrar atividade" deve entrar num só — proponho `completeLeadTask` com `tarefaId` opcional, e depois convergir o outro.
4. **`ultimo_toque_at` não vem na query do Kanban** — sem isso não há cor por toque.
5. **`_pipeline_ultima_acao_humana` conta `stage_changed_at` e `created_at`** como se fossem toque. Isso é justamente o que mascara lead parado. A régua nova por toque será mais dura: esperar aumento de âmbar/vermelho na primeira semana só-cor.
6. **Subfunil não existe** — Onda 3 é construção, não refatoração.
7. Pílula `sem_tarefa` e "Leads sem tarefa" do gestor permanecem no ar durante a Onda 1 (convivência). Só saem quando a saúde por toque virar padrão.

---

## 3. ONDA 1 — Motor de Atividade (passos de 1 build)

### Passo 1.1 — Tapar o furo do toque (sem UI)
- Arquivos: `src/hooks/usePipelineLeadData.ts` (`addAtividade`, `addAnotacao`), varredura dos pontos que sobem `ultima_acao_at` sem `registrarToque`.
- Migration: não.
- Reusar: `registrarToque.ts` como está.
- Risco: baixo. Validação: criar atividade num lead de teste e conferir `ultimo_toque_at` no banco.

### Passo 1.2 — Régua de saúde por toque (biblioteca pura + coluna na query)
- Novo `src/lib/leadHealth.ts`: `getLeadHealth(ultimoToqueAt, stageTipo)` → `em_dia | desatualizado | estagnacao`, com limites por etapa em constante única (BRT).
- `src/hooks/usePipeline.ts`: incluir `ultimo_toque_at` no `selectFields` e no tipo `PipelineLead`.
- Migration: não. Risco: baixo (nada consome ainda). Validação: teste unitário do helper + conferir no devtools que o campo chega.

### Passo 1.3 — Cor do card por toque (refino leve, sem redesenho)
- `CardMinimal.tsx`: a borda 4px passa a ler `getLeadHealth`; mantém sky/zinc para convertido/descarte e o azul de Novo Lead. Tooltip com "sem toque há Xd".
- Nada mais muda no layout.
- Risco: médio (percepção). Rollback: constante `HEALTH_BY_TOUCH_ENABLED` no próprio módulo.
- Validação no preview: abrir o Kanban, comparar 5 cards contra `ultimo_toque_at` no banco.

### Passo 1.4 — ⚡ Registrar atividade
- `completeLeadTask.ts`: aceitar `tarefaId: null` (não conclui tarefa, só grava atividade + toque + outcome opcional).
- `CardMinimal.tsx`: ⚡ sempre visível; se existir tarefa hoje/atrasada, o mesmo clique também conclui (✅ some, vira ⚡).
- `TaskCompletionDialog`: título/moldura "Registrar atividade" quando não há tarefa.
- Migration: não. Risco: médio — é o motor central. Validação: registrar atividade em lead sem tarefa e conferir `pipeline_atividades` + `ultimo_toque_at` + card virando verde.

### Passo 1.5 — 3 pílulas de saúde + filtro + ordenação
- `PipelineFiltroBadges.tsx`: pílulas Em dia / Desatualizado / Em estagnação por toque (mantendo `sem_tarefa` por ora).
- `PipelineAdvancedFilters.tsx`: filtro "sem contato há X dias".
- `pipelineSortOrder.ts`: nova ordem `toque` (mais antigo primeiro), sem remover `atividade`.
- Risco: baixo. Validação: alternar pílulas e conferir contagem contra query SQL.

### Passo 1.6 — Termômetro único
- Um badge só, lendo `oportunidade_score` via `scoreTemperatureLabels.ts`, com tooltip do "porquê" (toque + etapa + score). Aposentar a exibição paralela de `temperatura` em `PipelineLeadDetail` e `MissionBriefingDrawer`; a coluna continua no banco.
- Risco: baixo. Validação: abrir 3 leads e conferir um único badge coerente.

---

## 4. ONDA 2 — Régua de ociosidade + Modo Foco + Agenda
- **Migration 1:** `_pipeline_referencia_estagnacao` passa a usar `ultimo_toque_at` (com fallback ao cálculo antigo enquanto a flag estiver desligada) + flag em `system_flags` (`estagnacao_fonte_toque`). Nunca as duas fontes juntas.
- **Migration 2:** `pipeline_estagnacao_config` ganha teto diário por corretor; ligar primeiro só Qualificação, depois Aquecimento.
- Antes de ligar: mutirão dos +14d sem toque (relatório, não ação automática). Sem estagnação retroativa — carimbar `estagnado_em` só a partir da data de virada.
- Modo Foco: `FocusModeModal.tsx` passa a enfileirar por urgência de toque.
- Agenda de Lembretes: reframe de `MinhasTarefas.tsx`/`TarefasPage.tsx` (linguagem + agrupamento), sem mexer nas tarefas que são regra de negócio (Sem Contato, Visita, retorno de Nutrição, prazo em Negociação).
- Rollback: desligar a flag volta à fonte antiga sem migration.

## 5. ONDA 3 — Nutrição, PDN, Subfunil, Onboarding
- Reconciliar `lead_nurturing_*` com a Central de Nutrição manual: uma entrada (só Aquecimento), 4 saídas, anti-lixeira. Auditoria de leitura antes de qualquer escrita.
- PDN: `usePdn.ts` / `pdnSyncEngine.ts` em modo leitura-espelho antes de habilitar escrita.
- Subfunil de Qualificação: construção nova; arrastar grava só `flag_status.status_atendimento`, nunca `stage_id`.
- Onboarding "o CRM mudou": modal único por usuário.

## 6. ONDA 4 — /descartes, HOMI, Metas
- `/descartes` (CEO) lendo `motivo_descarte_code` de `discardReasons.ts`.
- HOMI (`homi-chat`/`homi-tools.ts`) lendo `ultimo_toque_at` e sugerindo "registre a atividade".
- Metas: leads atualizados/dia e % da carteira em dia, nos dashboards de gestor e CEO.

---

## 7. Ordem de execução e regras
1 passo por rodada, validado ao vivo no preview antes do próximo. Máx 2 migrations/dia (08–19h BRT). Migrar o antigo antes de ligar o novo. Nenhuma mudança na cadência Sem Contato. Nenhuma reescrita de histórico. BRT em tudo.

**Começamos pelo Passo 1.1.**
