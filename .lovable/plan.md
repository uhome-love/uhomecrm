# Plan — Migration A (Fase 0.5 v2): RLS hardening

## 1. Verificação pg_policies (executada)

Conferi os nomes reais via `pg_policies`. **Todos batem 100% com o snapshot do prompt** — nenhum `DROP IF EXISTS` vai falhar silenciosamente.

| Tabela | Policy a dropar | Confere? |
|---|---|---|
| `negocios` | `Users can view negocios` (SELECT, qual=true) | ✅ |
| `oferta_ativa_tentativas` | `Users can view own tentativas` (SELECT) | ✅ |
| `pipeline_tarefas` | `Gestores can manage tarefas` (ALL) | ✅ |
| `pipeline_tarefas` | `Corretores can view own tarefas` (SELECT) | ✅ |
| `pipeline_tarefas` | `Corretores can view tasks on their leads` (SELECT) | ✅ |
| `pipeline_atividades` | `Gestores can manage atividades` (ALL) | ✅ |
| `pipeline_atividades` | `Corretores can view own atividades` (SELECT) | ✅ |

### Policies preservadas (NÃO mexer)

- `negocios`: INSERT `Users can insert negocios` (with_check=true), UPDATE `Users can update negocios` (qual=true), DELETE `Admins and gestores can delete negocios` — **mantidas**.
- `oferta_ativa_tentativas`: INSERT (admin + own), UPDATE/DELETE admin — **mantidas**.
- `pipeline_tarefas`: INSERT/UPDATE/DELETE granulares de corretor (own + tasks on their leads) — **mantidas**. A "Gestores can manage tarefas" era a única ALL gestor; após o drop, gestor passa a escrever apenas via nova `pt_gestor_team_write` (escopada).
- `pipeline_atividades`: INSERT corretor own, UPDATE own, DELETE own — **mantidas**. Idem: gestor escreve via nova `pa_gestor_team_write`.

### Observação importante (mudança de comportamento intencional)

Hoje gestor pode INSERT/UPDATE/DELETE tarefa/atividade de **qualquer corretor**. Pós-migration: só do **próprio time** (validado pelas auditorias 0.25/0.4/0.6 — zero call site depende do escopo global).

## 2. Arquivo de migration

Migration única, criada via `supabase--migration` (DDL apenas, Regra 1). Conta como **1 de 2 do dia** (Regra 2).

## 3. Diff resumido do schema

```text
negocios
  - SELECT "Users can view negocios" (qual=true)            ──► DROP
  + SELECT "negocios_select_scoped"                          ──► CREATE
        (auth_user_id=uid OR gerente_id=uid OR admin
         OR corretor_id IN profiles do time
         OR EXISTS pipeline_parcerias ativa onde uid é principal/parceiro)

oferta_ativa_tentativas
  - SELECT "Users can view own tentativas"                   ──► DROP
  + SELECT "oat_select_scoped"                               ──► CREATE
        (corretor_id=uid OR admin OR corretor_id IN time)

pipeline_tarefas
  - SELECT "Corretores can view own tarefas"                 ──► DROP
  - SELECT "Corretores can view tasks on their leads"        ──► DROP
  - ALL    "Gestores can manage tarefas" (global)            ──► DROP
  + SELECT "pt_select_scoped"                                ──► CREATE
  + ALL    "pt_admin_all"                                    ──► CREATE
  + ALL    "pt_gestor_team_write" (escopada ao time)         ──► CREATE

pipeline_atividades
  - SELECT "Corretores can view own atividades"              ──► DROP
  - ALL    "Gestores can manage atividades" (global)         ──► DROP
  + SELECT "pa_select_scoped"                                ──► CREATE
  + ALL    "pa_admin_all"                                    ──► CREATE
  + ALL    "pa_gestor_team_write" (escopada ao time)         ──► CREATE
```

Total: 7 DROPs + 8 CREATEs = 15 statements em **1 migration**.

## 4. SQL final a aplicar

Idêntico ao bloco do prompt (já validado — todos os nomes de drop confirmados em pg_policies). Sem ajustes.

## 5. Plano de execução (após sua aprovação)

1. Chamar `supabase--migration` com o SQL completo + description em PT plano.
2. Após aprovação/execução pelo usuário: rodar `supabase--linter` e reportar diff de warnings.
3. Re-listar `pg_policies` para as 4 tabelas e colar como prova de estado final.
4. Entregar checklist de validação manual (snapshot VGV R$ 926k, /pipeline, Dashboard v4, DevTools 401/403, EXPLAIN).

## 6. Guardrails

- Nenhum código frontend tocado.
- Nenhuma RPC, cron, edge function ou tabela alterada.
- Policies write de `negocios` e `oferta_ativa_tentativas` permanecem `true` (fora do escopo desta fase — backlog).
- Rollback do prompt já aprovado, pronto para colar se algo quebrar.

**Aguardando autorização para Agent Mode.**
