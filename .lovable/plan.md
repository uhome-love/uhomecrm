# Correção de 3 quirks visuais no drawer do Lead Detail

Somente renderização e refresh de cache no frontend. Nenhuma regra de negócio, guardrail ou banco é alterado.

## Arquivos tocados (4)

1. `src/components/pipeline/drawer/DrawerProximaAcao.tsx` (bugs 1 e 2)
2. `src/components/pipeline/PipelineLeadDetail.tsx` (bug 2 — passar a hora; bug 1 — chamada de `parseNextActionType` nas Ações)
3. `src/components/pipeline/CadenciaSemContatoCard.tsx` (bug 3 — passar a usar React Query)
4. `src/lib/taskQueryUtils.ts` (bug 3 — invalidar a nova queryKey)

## Bug 1 — tipo/ícone errado no card "Próxima Ação"

Hoje `parseNextActionType()` monta o "bag" com `tipo + titulo + descricao + fallbackText` sempre, e o regex de `ligar` é avaliado antes de `whatsapp`. Um `lead.proxima_acao` defasado ("Ligar…") sobrepõe uma tarefa real de WhatsApp.

Mudança conceitual (mesma função, mesma assinatura, mesma ordem de regex):

```
const hasTask = !!(task?.tipo || task?.titulo || task?.descricao);
const bag = hasTask
  ? `${task.tipo} ${task.titulo} ${task.descricao}`.toLowerCase()   // sem fallbackText
  : `${fallbackText ?? ""}`.toLowerCase();
```

Sem tarefa concreta, o comportamento atual (usar o texto livre) é preservado. Como `PipelineLeadDetail` reusa a mesma função para escolher a ação primária do grid, o botão primário passa a acompanhar a tarefa real — efeito desejado e coerente.

## Bug 2 — horário 12:00 em vez da hora real

`vence_em` é só data; sem hora o parse cai no meio-dia. A hora real vive em `pipeline_tarefas.hora_vencimento` e hoje nem chega ao componente.

- `NextTaskLike` ganha `hora_vencimento?: string | null`.
- Ao montar `dueDate`: se `hora_vencimento` existir (formato `HH:mm[:ss]`), aplicar horas/minutos sobre a data parseada; senão, manter exatamente o comportamento atual.
- Em `PipelineLeadDetail.tsx`, `nextTask` já vem de `leadData.tarefas` (que carrega `hora_vencimento`) — basta garantir que o campo é repassado; nenhuma query nova.
- O mesmo critério de `overdue` do card passa a usar a data+hora composta (igual ao que o chip de status do drawer já faz nas linhas 449-460).

## Bug 3 — widget "CADÊNCIA SEM CONTATO" defasado

Causa confirmada: `CadenciaSemContatoCard` não usa React Query — busca com `useState` + `useEffect` que só roda quando `leadId` muda. Nenhum invalidate alcança esse componente, por isso ele fica na tentativa antiga até o F5.

Mudança conceitual:

- Trocar o `useEffect` por um `useQuery` com key `["cadencia-sem-contato", leadId]`, mantendo exatamente as mesmas 3 leituras em `Promise.all` (`lead_cadencia_sem_contato`, `cadencia_sem_contato_passos`, `pipeline_leads.estagnado_prazo_em`), o mesmo `enabled` (só quando `stageTipo === "sem_contato"`) e a mesma renderização — zero mudança visual.
- Em `invalidateTaskQueries()`, adicionar:

```
qc.invalidateQueries({ queryKey: ["cadencia-sem-contato"], refetchType: "all" });
```

Assim, ao concluir a tentativa, o widget refaz a leitura e mostra "Tentativa 3/7" na hora, sem reload.

Observação sobre o contador "Tentativas" do rodapé: ele vem de `callAttempts` (atividades do lead) e já é recarregado pelo `onReload` do drawer; se na validação ao vivo ele ainda ficar parado, o ajuste é apenas garantir que o `onReload` roda após a conclusão — não requer mudança de lógica.

## Confirmações explícitas

- Nada de `src/lib/createNextTask.ts` nem `src/lib/taskCompletion.ts` (o early-return de `sem_contato` fica intacto).
- Nenhuma migration, nenhum trigger (`trg_cadencia_sc_*`), nenhuma edge function.
- A criação da próxima tentativa em "Sem Contato" continua 100% pelo gatilho do banco; o widget passa apenas a *ler* o estado novo.
- Nenhuma query nova ao banco além da que o widget já fazia (mesmas leituras, só com cache gerenciado).
- Sem publish; typecheck ao final.
