# Domínio 13 — Automations (genérico) — VESTÍGIOS

> **TL;DR:** Existe a tabela `automations` + `automation_logs` + UI (`AutomacoesPage.tsx`) mas **não há executor**. Nunca rodou em produção.

## 1. Propósito (intencional, não real)
Permitir gestores criarem regras "quando X acontece → executar Y" sem código. Encapsulamento genérico de automações — similar a Zapier interno.

## 2. Estado real (evidências)
- `automations`: **1 linha**, `is_active=false`, `run_count=0`, `last_run_at=NULL`, criada 2026-03-07 (nome: "Boas-vindas ao novo lead")
- `automation_logs`: **0 linhas** (jamais executou)
- Nenhuma edge function chamada `automations-executor`, `run-automation`, ou similar
- Nenhum cron em `cron_health` referencia automations
- Grep no código: `AutomationWizard.tsx`, `AutomationLogsDialog.tsx`, `SequenceTemplates.tsx` existem mas sem chamada a edge function

## 3. Tabelas
### `automations` (12 col, 2 policies)
```
id, name, trigger_type, trigger_config jsonb, conditions jsonb, actions jsonb,
is_active, created_by, last_run_at, run_count, created_at, updated_at
```
Policies: gestor gerencia own, admin vê tudo.

### `automation_logs` (7 col, 2 policies)
```
id, automation_id, lead_id text, triggered_at, actions_executed jsonb, status, error_message
```

## 4. UI
- `src/pages/AutomacoesPage.tsx` — CRUD funcional (cria row, não executa)
- `src/components/automations/AutomationLogsDialog.tsx`
- `src/components/automations/SequenceTemplates.tsx`

## 5. Alternativas concorrentes no sistema
- `pipeline_playbooks` + `trg_pipeline_playbook_on_stage_change` — funcional
- `pipeline_sequencias` + `pipeline_sequencia_passos` + `pipeline_lead_sequencias` — funcional
- `nurturing_cadencias` + `cron-nurturing-sequencer` — funcional
- `cadencia_sem_contato_passos` + `lead_cadencia_sem_contato` — funcional via triggers

Ou seja: existem **4 mecanismos de automação funcionais** e o mais genérico (`automations`) é o que não foi implementado.

## 6. Histórico (git blame / commits)
> Nota: não foi possível rodar git blame contra o histórico completo neste ambiente (git em modo restrito). Recomendo:
> ```
> git log --all --diff-filter=A -- src/components/automations/ 
> git log --all --oneline -- supabase/migrations/*automations*
> git log --all --oneline -- src/pages/AutomacoesPage.tsx
> ```
> para descobrir:
> - Quando as tabelas foram criadas
> - Se houve edge function que foi removida (git log --diff-filter=D supabase/functions)
> - Quem criou o registro da tabela em 07/03/2026 (`created_by` uuid disponível)

Sinal indireto: só há **UM** registro em `automations` e criado logo depois da migration inicial → indica que foi criado como demo/teste e nunca voltou.

## 7. Perguntas
1. **Foi feature planejada e nunca priorizada?** Ou foi implementada, removida e ficou o schema?
2. Se remover: safe drop de `automations`, `automation_logs`, `AutomacoesPage.tsx`, `src/components/automations/*`?
3. `SequenceTemplates.tsx` — parece ligado a `pipeline_sequencias`, não a `automations`. Merge?
4. `AutomationLogsDialog.tsx` está referenciado em algum outro lugar (Menu Admin)?
5. Se manter: prioridade para implementar executor? Modelo pretendido (event queue? cron scanner?)?
6. `trigger_type` no schema é `text` — que valores foram desenhados originalmente? Só "lead_arrived"?

## Recomendação
Rodar `git log --oneline --all -- src/pages/AutomacoesPage.tsx supabase/functions/` para confirmar se houve executor removido antes de deletar ou reimplementar. Se nenhum vestígio de executor, é **feature aspiracional** — decidir: implementar ou remover UI+tabelas.
