## Auditoria + consolidação canônica de tarefas (Pendente)

### 1. Auditoria do RPC `get_dashboard_gerente_v4_kpis` — ✅ JÁ CORRETO

A CTE `tarefas_atr` (linhas 121–133) já aplica a regra canônica:

```sql
pt.status = 'pendente'
AND (
  pt.vence_em < v_today
  OR (pt.vence_em = v_today
      AND COALESCE(pt.hora_vencimento, '23:59'::time)
          < (v_now AT TIME ZONE 'America/Sao_Paulo')::time)
)
```

- Default de `hora_vencimento` = `23:59` ✅
- Hoje + hora já passada conta como atrasada ✅
- BRT timezone ✅

**Conclusão:** o `tarefas_atrasadas` exibido em `V4PanelAlertas` no dashboard do gerente já está coerente com a Central de Tarefas e o `/corretor`. **Nenhuma migration necessária.**

### 2. Consolidação no frontend (DRY)

Hoje a mesma regra está reimplementada em 3 lugares com pequenas variações:

- `src/lib/taskBuckets.ts` → `classifyTask()` (canônico, criado nesta rodada)
- `src/components/pipeline/CardStatusLine.tsx` (linhas 49–96) → lógica inline
- `src/lib/taskQueryUtils.ts` (linhas 220–245) → comparador `chooseProximaTarefa` inline

**Ação:** refatorar `CardStatusLine.tsx` para usar `classifyTask()` ao decidir `proximaTarefa` (atrasada/hoje/futura) e o badge — sem mudar comportamento visual. `taskQueryUtils.ts` é só ordenação (vence_em+hora ASC com default 23:59), já equivalente; deixar como está, apenas adicionar comentário apontando para `taskBuckets.ts` como fonte da verdade.

### 3. Validação

- Smoke test caso Adri: dashboard `/corretor`, Central `/minhas-tarefas` e Pipeline (cards) devem mostrar a mesma contagem de "atrasadas" para o mesmo conjunto de tarefas.
- Gerente: `V4PanelAlertas` mostra `tarefas_atrasadas` por corretor com a mesma regra (já validado por auditoria SQL).

### Arquivos a editar

- `src/components/pipeline/CardStatusLine.tsx` — usar `classifyTask` em vez da lógica inline.
- `src/lib/taskQueryUtils.ts` — comentário apontando para `taskBuckets.ts`.

### Fora de escopo

- SQL/migration (não é necessário).
- Mudanças visuais nos cards/pipeline.
- Lógica de SLA, recyclagem 72h, modo foco.
