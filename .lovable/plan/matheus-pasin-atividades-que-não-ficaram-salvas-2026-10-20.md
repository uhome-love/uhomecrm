# Matheus Pasin — atividades que "não ficaram salvas"

## O que encontrei

- **Neodila Baratto e Aida Ana Fabrin (Aquecimento):** nenhum registro de hoje chegou ao sistema. Não há atividade, anotação nem tarefa nova. A última atividade gravada é de 13/10 (Neodila) e 14/10 (Aida). Por isso o card mostra "há 6–7 dias".
- **O resto do dia dele funcionou.** Hoje ele registrou 7 atividades, 4 delas no próprio Aquecimento (Eva Vitória, Giovana Trovo, Vinicius Junqueira e Carla Cunha). Nesses quatro o card atualizou certinho.
- **Não houve erro do lado do sistema.** Nenhuma gravação foi recusada nem deu erro na tarde de hoje. Então não é uma instabilidade geral: as tentativas nesses dois clientes nunca chegaram ao servidor.
- **Causas mais prováveis, sem confirmação ainda:**
  1. Ele escreveu e fechou a janela sem apertar salvar, ou salvou uma tarefa em vez de um contato.
  2. Usou um caminho do sistema que, quando falha (por exemplo, por internet instável), **não mostra aviso**. Existem cerca de 12 lugares que gravam atividade sem conferir se deu certo. A janela principal "Registrar atividade" confere e avisa; esses outros, não.
- **Outros corretores:** não achei sinal de falha em massa. Como os registros de rede só guardam os últimos minutos, não dá para provar o que aconteceu às 14h no aparelho dele.

## O que proponho corrigir

1. **Nenhum registro falhar em silêncio.** Em todos os lugares onde se registra contato (ligação, WhatsApp, concluir tarefa, visita, modo foco, lista de ligações), se a gravação falhar aparece "Não foi possível salvar, tenta de novo" e a janela não fecha.
2. **Guardar um rastro quando falhar.** Cada falha de registro fica anotada com corretor, cliente, horário e motivo. Assim, na próxima reclamação dá para provar na hora o que aconteceu.
3. **Confirmação visível.** Depois de salvar um contato, o card do cliente mostra "última atividade · agora" na mesma hora. Se não mostrar, o corretor sabe que não salvou.
4. **Pedir ao Matheus** que registre de novo Neodila e Aida e conte por qual botão fez. Eu não vou criar atividade no nome dele.

## Detalhes técnicos

- Pontos sem checagem de `error` após `insert` em `pipeline_atividades`: `taskCompletion.ts`, `completeLeadTask.ts`, `pipelineAudit.ts`, `VisitaCompletionFlow.tsx`, `LeadTarefasTab.tsx`, `WhatsAppTemplatesDialog.tsx`, `WhatsAppFocusFlow.tsx`, `CallFocusOverlay.tsx`, `FocusModeModal.tsx`, `DrawerNegocioTab.tsx`, `useCustomListQueue.ts`, `useHomiActions.ts`. Em todos eles: checar `error`, lançar o erro e mostrar toast.
- Um helper único `registrarAtividade()` em `src/lib/`, que insere, confere o erro e, em caso de falha, grava em `ops_events` (tabela já existente, sem migration) com `fn='registro_atividade'`.
- `RegistrarAtividadeModal` já confere o erro. Só passa a usar o helper.
- Sem mudança no banco nem nas regras de toque e saúde do CRM.
- Validação: lead de teste, forçar falha simulando offline no navegador, conferir o aviso e o rastro em `ops_events`, depois apagar o lead de teste.
