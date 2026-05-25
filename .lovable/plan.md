
# Padronização dos KPIs de Tarefas

## Diagnóstico

Encontrei **três regras diferentes** rodando em paralelo. Por isso a Adri vê 15 hoje / 0 atrasadas no dashboard e 4 hoje / 11 atrasadas na Central.

### Regras canônicas (definidas por você)

1. **Para hoje** = tarefas pendentes com `vence_em = hoje` BRT — **independente** de já ter passado da hora.
2. **Atrasadas** = tarefas pendentes onde `vence_em < hoje` **OU** (`vence_em = hoje` **E** `hora_vencimento` já passou em BRT). Quando `hora_vencimento` é nulo, default = `23:59` (consistente com SLA memory).
3. **Leads sem tarefa** = leads ativos do corretor sem nenhuma tarefa com `status='pendente'`.

> Os buckets **se sobrepõem**: uma tarefa hoje às 10:00, agora 16:00, aparece em **ambos** "Para hoje" e "Atrasadas".

### Estado atual (por local)

| Local | Para hoje | Atrasadas | Sem tarefa | Status |
|---|---|---|---|---|
| Dashboard `/corretor` (`useCorretorKpisCarteira`) | LEADS, régua mutuamente exclusiva, **ignora hora** | LEADS, só `data<hoje` (ignora hora) | LEADS ✓ | ❌ Errado |
| Central `/minhas-tarefas` | TAREFAS com `data=hoje` (sem hora) | LEADS DISTINCT (regra com hora ✓) | LEADS (`desatualizados`) ✓ | ⚠️ Mistura unidade |
| Pipeline (`getLeadStatusFilter`) | classe `em_dia` | classe `tarefa_atrasada` (regra correta) | classe `desatualizado` ✓ | ✅ Correto |
| Dashboard gerente (RPC `get_dashboard_gerente_v4_kpis`) | n/a | `tarefas_atrasadas` por alerta — precisa auditar | n/a | ⚠️ Auditar |

### Caso Adri explicado

15 tarefas com `vence_em=hoje`, 11 delas com `hora_vencimento` já passado. O dashboard joga as 15 em "Para hoje" porque só olha data (= 15 / 0 atrasadas). A Central separa as 11 em "Atrasadas" e mantém 4 em "Hoje" (sem hora passada). Nenhum está 100% conforme a sua regra: o correto é **15 hoje + 11 atrasadas** (sobreposição), e em qualquer tela.

---

## Solução

### 1. Helper canônico único — `src/lib/taskBuckets.ts` (novo)

Exporta:

```ts
classifyTask(t: { vence_em: string|null, hora_vencimento: string|null }, nowBRT: Date)
  → { isToday: boolean, isOverdue: boolean }
// isToday: vence_em == YYYY-MM-DD do nowBRT
// isOverdue: vence_em < hoje  OU  (vence_em == hoje E (hora_vencimento ?? '23:59') < HH:MM atual BRT)
```

Mais um wrapper `computeTaskBuckets(tarefas, leadsAtivos)` que retorna:
- `tarefas_hoje` (count de tarefas)
- `tarefas_atrasadas` (count de tarefas)
- `leads_sem_tarefa` (count de leads distintos sem tarefa pendente)
- `leads_em_dia` (resto — para o cartão "Em dia")

Tudo BRT, usando `todayBRT()` e `nowBRT()` já existentes em `src/lib/brtTime.ts`/`utils`.

### 2. Reescrever `src/hooks/useCorretorKpisCarteira.ts`

Trocar a "régua mutuamente exclusiva por lead" pelas 3 métricas canônicas (tarefas para hoje, tarefas atrasadas, leads sem tarefa). Manter o 4º bloco "Em dia" como leads ativos que não estão em "sem tarefa" e não têm tarefa atrasada nem hoje (cumprida/futura).

Interface nova:
```ts
{ tarefas_hoje, tarefas_atrasadas, leads_sem_tarefa, leads_em_dia, total }
```

### 3. Ajustar `src/components/corretor/CarteiraKpis.tsx`

- "Para hoje" → `tarefas_hoje`
- "Atrasados" → `tarefas_atrasadas`
- "Sem tarefa" → `leads_sem_tarefa`
- "Em dia" → `leads_em_dia`

Adicionar microcopy explicando a sobreposição: "tarefas para hoje (inclui atrasadas)".

### 4. `src/pages/MinhasTarefas.tsx`

- Tab "🔴 Atrasadas": passar a contar **tarefas** (`atrasadasTarefas.length`) — não leads distintos — para alinhar com dashboard. Manter o filtro visual por lead se quiser, mas o **contador** vira tarefas.
- Tab "📅 Hoje": já é tarefas (ok). Adicionar tooltip "inclui atrasadas de hoje".
- Recalcular `atrasadasTarefas` via `classifyTask().isOverdue` (regra unificada). Hoje usa `ownedLeadStatusMap` que classifica por LEAD; trocar para classificação por TAREFA.
- Tab "🟡 Desatualizados" continua sendo LEADS sem tarefa (ok).

### 5. Pipeline `getLeadStatusFilter` (CardStatusLine)

Já está consistente com a regra. **Manter**. Apenas substituir o cálculo de "hora passou" pelo helper para evitar duplicação.

### 6. Dashboard Gerente — RPC `get_dashboard_gerente_v4_kpis` e `V4PanelAlertas`

Auditar o SQL da função (campo `tarefas_atrasadas` por corretor) e garantir que use a mesma regra `vence_em<hoje OR (vence_em=hoje AND hora<now)`. Se estiver só por data, criar migration corrigindo (1 migration, dentro do limite diário).

### 7. Smoke test manual

- Caso Adri (15 hoje, 11 atrasadas, 4 ainda no horário):
  - Dashboard → Para hoje: **15**, Atrasadas: **11**
  - Central → Hoje: **15**, Atrasadas: **11**
  - Pipeline (filtro Atrasados): **leads distintos** das 11 tarefas

---

## Fora de escopo

- Mudar lógica de SLA, recyclagem 72h, modo foco.
- Refatorar `getLeadStatusFilter` para outros usos além de tarefa.
- UI/visual além dos rótulos do dashboard e tooltip da Central.

## Arquivos tocados

- **Novo:** `src/lib/taskBuckets.ts`
- `src/hooks/useCorretorKpisCarteira.ts` (reescrita da régua)
- `src/components/corretor/CarteiraKpis.tsx` (labels e mapping)
- `src/pages/MinhasTarefas.tsx` (contador de atrasadas vira tarefas; reaproveita helper)
- `src/components/pipeline/CardStatusLine.tsx` (reaproveita helper, comportamento igual)
- Migration condicional em `get_dashboard_gerente_v4_kpis` se a regra atual estiver só por data.
