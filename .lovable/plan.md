## Objetivo

Eliminar o flash de "Nenhuma tarefa pendente" / "Sem tarefas pendentes" enquanto as tarefas do lead ainda estão carregando, mostrando um **skeleton** nas duas abas de tarefas. Nenhuma funcionalidade existente é alterada — apenas adicionamos um estado visual de carregamento.

## Causa

`usePipelineLeadData` já tem um flag `loading`, mas:
- ele não é repassado para `DrawerTasksTab` nem `LeadTarefasTab`, então as abas mostram o empty state durante o fetch;
- o `loading` só vira `true` quando o `loadAll` roda (um frame depois da abertura), deixando um instante com `loading=false` e lista vazia.

## Mudanças (somente frontend, sem schema)

### 1. `src/hooks/usePipelineLeadData.ts`
- Adicionar um efeito que liga `loading=true` imediatamente quando `leadId` fica definido (e `false` quando nulo), antes do `loadAll` completar:
```ts
useEffect(() => {
  if (leadId) setLoading(true); else setLoading(false);
}, [leadId]);
```
- Nada mais muda; `loading` já é retornado pelo hook e usado internamente. As mutações continuam idênticas.

### 2. `src/components/pipeline/PipelineLeadDetail.tsx`
- Passar `loading={leadData.loading}` para `<DrawerTasksTab>` e `<LeadTarefasTab>`.

### 3. `src/components/pipeline/drawer/DrawerTasksTab.tsx`
- Adicionar prop opcional `loading?: boolean`.
- Quando `loading && tarefas.length === 0`, renderizar um skeleton (3 linhas usando `@/components/ui/skeleton`) no lugar do empty state. O empty state "Nenhuma tarefa pendente" só aparece após a carga terminar com lista vazia.

### 4. `src/components/pipeline/LeadTarefasTab.tsx`
- Adicionar prop opcional `loading?: boolean`.
- Mostrar skeleton (3 linhas) quando `loading && pendentes.length === 0 && !showForm`, e suprimir o bloco "📋 Sem tarefas pendentes" enquanto `loading` for `true`.

## Garantias de não-regressão
- Props novas são opcionais → nenhum outro chamador quebra.
- Lógica de criação/conclusão/adiar/editar tarefa e todas as invalidações (`invalidateTaskQueries`) permanecem intactas.
- Sem mudança de dados, RLS, timezone ou comportamento de negócio.

## Verificação
- Abrir um lead no pipeline e confirmar skeleton → lista (sem flash de "Nenhuma tarefa").
- Lead sem tarefas: skeleton breve → empty state correto.
- Criar/concluir tarefa: continua atualizando modal, Central de Tarefas e cards do Kanban.
