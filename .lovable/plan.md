## Objetivo
Adicionar a etapa **Pós-Visita** entre **Visita** (ordem 4) e **Em Negociação** (ordem 5). Regra fixa: **toda visita realizada — inclusive "gostou/quer proposta" — passa OBRIGATORIAMENTE por Pós-Visita**, para definição conjunta corretor+gerente antes de virar negócio.

## Mapa de impacto

### Banco (1 migration única)
- `pipeline_stages`: `INSERT` da nova etapa `pos_visita` (ordem 5, cor `#06b6d4`, `pipeline_tipo='leads'`); `UPDATE ordem = ordem+1` para Em Negociação (→6), Contrato (→7), Ganho (→8).
- `trg_clear_negocio_on_stage_regress`: cutoff que preserva `negocio` sobe de `ordem >= 5` para `ordem >= 6` — regredir para Pós-Visita/Visita/Aquecimento/Qualificação arquiva o `negocio` (`status='arquivado'`).
- `trg_pdn_mirror_pipeline_lead` (CASE): remover `WHEN 'visita' THEN 'visita_realizada'`; adicionar `WHEN 'pos_visita' THEN 'pos_visita'`. Leads em Visita saem do PDN; entram quando chegam em Pós-Visita.
- `notify_visita_realizada_gerente`: trocar `v_stage_tipo='visita_realizada'` (dead code) por `'pos_visita'`.
- `trg_visita_stage_entry_fn` / `fn_reconciliar_visita_auto`: ao entrar em `pos_visita`, criar tarefa `pegar_feedback` (48h) se não existir; cancelamentos existentes ao sair de `visita` permanecem.

### Data patch (insert, após migration aprovada)
- Contagem prévia + `UPDATE pipeline_leads SET stage_id=<pos_visita>` para leads hoje em `Visita` com `flag_status->>'status_visita'='realizada'` e `arquivado=false`. Não mexer em `stage_changed_at`.

### Auto-move após visita (frontend)
- `src/hooks/useVisitas.ts` `updateStatus`: se `newStatus='realizada'` e stage atual = `visita`, mover `stage_id` para `pos_visita` (mantém `flag_status.status_visita='realizada'`). Toast passa a orientar "Alinhe com o gerente na Pós-Visita".
- `src/lib/visitaResultadoRouting.ts` `ROUTES`: **todos** os resultados de visita realizada apontam para `pos_visita`:
  - `continuar_visitando` → `pos_visita`
  - `gostou_quer_proposta` → `pos_visita` + flag `status_negociacao='proposta_solicitada'` (corretor arrasta manual para Em Negociação com o gerente)
  - `gostou_vai_pensar` → `pos_visita` (deixa de ir direto para aquecimento — Pós-Visita é obrigatória)
  - `quer_ver_outro` → `pos_visita` + flag `precisa_novas_opcoes=true`
  - `nao_gostou` → `pos_visita` + flag sugerida `descarte_sugerido=true` (decisão final com gerente)
  - `nao_compareceu` → `aquecimento` (não realizou — mantém rota atual, no-show não passa por Pós-Visita)
  - `reagendar` → mantém `visita` (não realizou)

### Pipeline UI
- `src/components/pipeline/PipelineBoard.tsx` e `PipelineMobileView.tsx`: remover `pos_visita` de `HIDDEN_STAGE_TIPOS`; adicionar tema (`--stage-pos-visita` já existe em `index.css`).
- `src/components/pipeline/PipelineLeadDetail.tsx`: rótulo `pos_visita: "Pós-Visita"`.
- `src/components/pipeline/PipelineStageTransitionPopup.tsx`: branch `pos_visita` já existe (linhas ~1187–1247) — validar textos.
- `src/lib/leadHelpers.ts`: substatus da etapa Pós-Visita: `aguardando_alinhamento` (default), `alinhado_evoluir`, `alinhado_regredir`, `sem_retorno_gerente`.
- `src/components/pipeline/LeadFlagBadges.tsx`, `LeadFlagControls.tsx`, `StageCoachBar.tsx`: já reconhecem `pos_visita` — ajustar labels novos.
- `src/components/pipeline/PipelineAdvancedFilters.tsx`: incluir `pos_visita` no filtro "com visita".

### PDN
- `src/hooks/usePdn.ts`: `PdnGrupo` — renomear `"visita_realizada"` → `"pos_visita"`; `normalizeGrupo` aceita legacy (`visita_realizada`, `visita` → `pos_visita`); `PDN_GRUPOS[0]` = `{ key:"pos_visita", label:"Pós-Visita", cor:"#06b6d4" }`; `STAGE_TIPO_TO_GRUPO`: adicionar `pos_visita:"pos_visita"`, remover `visita`; ajustar `GRUPO_LABEL`, `GRUPO_KEYS`, agregações e `mudarEtapa`.
- `src/lib/pdnSyncEngine.ts`: `PdnDestino` inclui `"pos_visita"`; `GRUPO_TO_STAGE_TIPO.pos_visita = "pos_visita"`; `isRegressao` considera Pós-Visita como regressão vinda de Em Negociação/Contrato/Ganho.
- `src/pages/PdnGestor.tsx`: `PDN_GROUPS_ORDER` — chave `pos_visita`, `em_negociacao.previous = "pos_visita"`; card "no mês" passa a contar leads que caíram em Pós-Visita; labels visíveis "Visita Realizada" → "Pós-Visita".
- `src/components/pdn/PdnKanban.tsx`: renomear chave em `PROB_POR_GRUPO`.
- `src/components/pdn/PdnRegredirDialog.tsx`: `ORDER = ["qualificacao","aquecimento","pos_visita","em_negociacao","contrato","ganho"]`; adicionar `pos_visita:"Pós-Visita"` em `GRUPO_LABEL`.

### Notificação ao corretor
- Ao chegar em Pós-Visita (via auto-move ou drag manual), disparar notificação `visita_realizada_alinhar` para o corretor: "Sua visita com {cliente} foi registrada. Alinhe com o gerente antes de evoluir." Trigger `notify_visita_realizada_gerente` (agora em `pos_visita`) cobre o lado do gerente.

### Diagrama
```text
Novo → Sem Contato → Qualificação → Aquecimento → Visita → Pós-Visita → Em Negociação → Contrato → Ganho
                                                    │           │              ▲
                                                    │      (definição          │
                                                    │       corretor+gerente)  │
                                                    │           │              │
                                                    └── auto ───┘              │
                                                                └── regride ───┘
```

## Fases (ordem estrita, cada uma valida antes da próxima)

**Fase A — Migration schema+triggers** (1 migration): pipeline_stages + 4 triggers/funções.
**Fase B — Data patch** (insert): mover leads legados de Visita+realizada para Pós-Visita, após contagem apresentada.
**Fase C — Frontend PDN** (rename grupo): `usePdn`, `pdnSyncEngine`, `PdnKanban`, `PdnGestor`, `PdnRegredirDialog`.
**Fase D — Frontend Pipeline**: remover `HIDDEN`, rótulos, filtros, substatus.
**Fase E — Auto-move + roteamento**: `useVisitas.updateStatus`, `visitaResultadoRouting.ROUTES`.
**Fase F — Validação ponta a ponta** em lead de teste:
- Marcar visita realizada na Agenda → lead sai de Visita e entra em Pós-Visita; tarefa `pegar_feedback` criada.
- `VisitaResultadoDialog` com "gostou_quer_proposta" → lead vai para Pós-Visita (não pula para Em Negociação) com flag `proposta_solicitada`.
- Board mostra coluna Pós-Visita entre Visita e Em Negociação.
- PDN mostra o lead em "Pós-Visita"; contagem `visitasMes` inclui.
- Mover Pós-Visita → Em Negociação cria/atualiza `negocios` em `em_negociacao`.
- Regredir Em Negociação → Pós-Visita via `PdnRegredirDialog` com motivo: `pipeline_leads.stage_id`=pos_visita, `negocios.status='arquivado'`+`motivo_queda`, notificação `pdn_regressao` disparada.
- Console limpo, PDN não pisca (debounce mantido).

## Fora de escopo
- RLS/policies (herdadas).
- Enum `pipeline_stage_type` (coluna é TEXT).
- Roleta/Distribuição, Oferta Ativa, Ganho/Contrato/Descarte.
