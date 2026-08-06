# Onda 1 — Camada visual + Registrar Atividade (SÓ-COR)

Regra desta onda: nada aqui remove, move ou devolve lead. A régua de estagnação continua lendo `ultima_acao_at` (RPC `get_pipeline_estagnacao` / `decidir_lead_estagnado`). `ultimo_toque_at` entra apenas como **cor, pílula, filtro e ordenação**.

## (a) Como as telas leem hoje — arquivos reais

Kanban / board
- `src/pages/PipelineKanban.tsx` — orquestra tudo: carrega leads via `usePipeline`, monta `tarefasMap` (`ProximaTarefa` por lead) com `fetchInBatchesWithRetry`, aplica `getLeadStatusFilter`, filtros e sort, e passa para o board.
- `src/components/pipeline/PipelineBoard.tsx` (1162 linhas) — colunas por etapa, drag/drop (`handleDrop` → `needsTransitionPopup` → `completeTransition` / `handleTransitionConfirm`). É aqui que substatus já é gravado em `flag_status` (`status_atendimento`, `status_negociacao`, `status_contrato`, `prazo`).
- `src/components/pipeline/CardMinimal.tsx` (600 linhas) — card: borda esquerda 4px por status de tarefa (vermelho atrasada / emerald em dia / âmbar sem tarefa), próxima ação, substatus via `getLeadSubstatusBadge`.
- `src/components/pipeline/PipelineMobileView.tsx` — mesma lógica de status em lista.

Substatus (fonte única)
- `src/lib/leadHelpers.ts` — `QUALIFICACAO_SUBSTATUS` (contato_inicial, alinhamento_perfil, busca, follow_up, alinhando_visita), demais etapas, e `getLeadSubstatusBadge`.
- `src/components/pipeline/LeadFlagBadges.tsx` — mapa paralelo `FLAG_CONFIGS` (duplicação de rótulos com leadHelpers).
- `src/components/pipeline/LeadFlagControls.tsx` — edição de substatus no drawer.

Saúde / estagnação
- `src/lib/taskQueryUtils.ts` → `getLeadStatusFilter` devolve `em_dia | desatualizado | tarefa_atrasada` (baseado em tarefa, não em toque).
- `src/hooks/useLeadsParados.ts` — dias parados por `ultima_acao_at` (3-5 warning / 6+ danger); uso local, não move nada.
- `src/hooks/usePipelineEstagnacao.ts` — RPC `get_pipeline_estagnacao` + `decidir_lead_estagnado` (tela `/leads-estagnados`, `EstagnacaoStatusCard.tsx`). **É a régua real — intocada nesta onda.**
- `src/components/pipeline/PipelineManagerActions.tsx` — contadores "sem tarefa" / "atrasadas".

Termômetro / score
- `usePipeline` seleciona `temperatura` e `oportunidade_score` (colunas de `pipeline_leads`); `selectFields` **não inclui `ultimo_toque_at`** hoje.
- `src/components/ScoreBadge.tsx` — sem nenhum consumidor no app (import zero). `src/lib/leadScoring.ts` (calculateLeadScore/SLA) também está sem consumidor no Pipeline. `src/lib/scoreTemperatureLabels.ts` é a camada legível já pronta.
- Ordenação `temperatura` já existe em `src/lib/pipelineSortOrder.ts` + `PipelineSortDropdown.tsx`.

Registrar atividade (hoje espalhado)
- `QuickActionMenu.tsx` — insere em `pipeline_atividades`, atualiza `ultima_acao_at` e chama `registrarToque`.
- `NextActionModal.tsx`, `src/lib/taskCompletion.ts`, `src/lib/completeLeadTask.ts`, `task-completion/VisitaCompletionFlow.tsx`, `FocusModeModal.tsx`, `WhatsAppTemplatesDialog.tsx`, `WhatsAppFocusFlow.tsx`, `src/lib/visitaResultadoRouting.ts` — todos já chamam `registrarToque` (Onda 0).
- `src/lib/registrarToque.ts` — helper único, já publicado.

## (b) Plano de build faseado — tudo SEM migration

`flag_status`, `ultimo_toque_at`, `temperatura` e `oportunidade_score` já existem. Nenhum build abaixo precisa de migration.

**Build 1 — Subfunil de Qualificação (Fase B)**
- Novo `src/components/pipeline/subfunil/SubfunilQualificacao.tsx`: tela cheia com 6 colunas = 5 valores de `QUALIFICACAO_SUBSTATUS` + "⚠ Sem status".
- Entrada: botão no header da coluna Qualificação (`PipelineBoard`) e/ou `?view=subfunil` no `PipelineKanban` (reusa o padrão de query string já existente).
- Drop grava **apenas** `flag_status.status_atendimento` (merge do objeto atual) via update em `pipeline_leads`. Não toca `stage_id`, `stage_changed_at`, `negocio_id`, nem cria tarefa.
- Mapa de compatibilidade `LEGACY_STATUS_ATENDIMENTO` em `leadHelpers.ts` para valores antigos (ex.: `atendimento`/`qualificacao`/`follow`/`alinhando_perfil` → canônico); valor desconhecido cai na coluna "Sem status" sem ser reescrito automaticamente.
- Reusa `CardMinimal` para os cards.

**Build 2 — Camada de saúde por toque (só leitura/cor)**
- `usePipeline`: adicionar `ultimo_toque_at` ao `selectFields` e ao tipo `PipelineLead`.
- Novo `src/lib/leadSaude.ts`: `getSaudeToque(lead)` → `em_dia | desatualizado | em_estagnacao` + `diasSemToque`, thresholds em constantes (padrão 3 / 7, configurável no arquivo). Puro, sem side-effect.
- `CardMinimal`: pílula de saúde + borda de urgência **adicional** — a borda esquerda por tarefa continua como está (não substituir), a urgência entra como cor/anel secundário. Nenhuma remoção de lead.

**Build 3 — Diálogo único "Registrar atividade"**
- Novo `src/components/pipeline/RegistrarAtividadeDialog.tsx`, extraindo a lógica que hoje está inline no `QuickActionMenu` (insert em `pipeline_atividades` + `ultima_acao_at` + `registrarToque`) para `src/lib/registrarAtividade.ts`.
- `QuickActionMenu` passa a consumir esse helper (comportamento idêntico), e o card ganha a ação única "Registrar" (Nutrir só aparece em Aquecimento).
- Fluxo de conclusão de tarefa 3-em-1 (`completeLeadTask` / `TaskCompletionDialog` / `NextActionModal`) **não é alterado** — só continua chamando `registrarToque` como já faz.

**Build 4 — Termômetro reconciliado + filtro + ordenação**
- Novo `src/components/pipeline/TermometroBadge.tsx`: lê `temperatura` (rótulo do corretor) e `oportunidade_score` (via `scoreTemperatureLabels.ts`), mostra um badge só + tooltip com o "porquê" (fatores de `leadScoring.ts`, camada legível).
- Deletar `src/components/ScoreBadge.tsx` (zero imports hoje — remoção segura).
- Filtro "sem contato há X dias" (3/7/15/30/60) em `PipelineAdvancedFilters.tsx`, calculado sobre `ultimo_toque_at` no client.
- Ordenação: acrescentar "Precisa de atenção" em `pipelineSortOrder.ts` + `PipelineSortDropdown.tsx` (mantendo `atividade`, `temperatura`, `mais_recente` intactos, e o localStorage tolerando o valor novo).

Ordem sugerida: 1 → 2 → 3 → 4, validando no preview a cada build.

## (c) Reusa vs cria novo

Reusa: `flag_status`, `QUALIFICACAO_SUBSTATUS`/`leadHelpers`, `CardMinimal`, `PipelineBoard` (só entrada do subfunil), `registrarToque`, `scoreTemperatureLabels`, `leadScoring`, `pipelineSortOrder`, `PipelineAdvancedFilters`, `usePipeline`.

Cria novo: `subfunil/SubfunilQualificacao.tsx`, `lib/leadSaude.ts`, `RegistrarAtividadeDialog.tsx`, `lib/registrarAtividade.ts`, `TermometroBadge.tsx`, constante `LEGACY_STATUS_ATENDIMENTO`.

Remove: `src/components/ScoreBadge.tsx`.

## (d) Riscos e o que NÃO tocar

Riscos
- Duplicação de rótulos entre `leadHelpers.getLeadSubstatusBadge` e `LeadFlagBadges.FLAG_CONFIGS` — o subfunil consome só `leadHelpers`; unificar fica para depois.
- Merge de `flag_status`: sempre `{...atual, status_atendimento}` — sobrescrever o objeto inteiro apagaria `tipologia`, `prazo`, `status_visita`.
- Board de 1162 linhas: entrada do subfunil deve ser um botão + rota, sem refatorar `handleDrop`.
- Adicionar coluna ao `selectFields` aumenta payload marginalmente; sem impacto de RLS.

NÃO tocar: `get_pipeline_estagnacao`, `decidir_lead_estagnado`, `usePipelineEstagnacao`, `LeadsEstagnados.tsx`, `EstagnacaoStatusCard`, `CadenciaSemContatoCard` e o guardrail Sem Contato; `pipeline_tarefas` e todo o fluxo 3-em-1 (`completeLeadTask`, `taskCompletion`, `TaskCompletionDialog`, `NextActionModal`); `handleTransitionConfirm` (descarte/caiu/negócio/visita); PDN, CAPI, roleta, relatórios; qualquer escrita de `ultima_acao_at`; nenhuma migration.

## (e) Confirmação

Nada nesta onda liga remoção, devolução ou movimentação automática por estagnação — isso é Onda 2. `ultimo_toque_at` é usado somente para pílula, borda, filtro e ordenação (visual e client-side). A régua atual segue 100% em `ultima_acao_at`, com as mesmas RPCs e as mesmas escritas de hoje.
