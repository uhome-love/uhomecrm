# Tarefas — revisão final de erros

## O que já está certo (conferido agora)
- Abas: "Vencidas" = dias anteriores a hoje; "Hoje" = todas as tarefas de hoje, inclusive as que já passaram do horário. É exatamente a regra que você descreveu, então não muda nada aqui.
- Nenhum erro de tela ou de sistema registrado no momento.

## O que vou fazer
1. Na aba "Hoje", destacar em vermelho (com "atrasada") a tarefa de hoje cujo horário já passou, para o corretor saber que tem que fazer primeiro. Ela continua em "Hoje".
2. Testar de novo, com um cliente de teste, a última mudança (a próxima tarefa não copia mais a observação, então o ícone fica certo, "Ligar"/"Contato" e não "Visita").
3. Testar o que ficou de fora: o botão "Registrar" no cartão do cliente no Pipeline (concluir tarefa por ali também tem que pedir observação e atualizar a próxima ação).
4. Conferir a janelinha que abre ao passar o mouse no cartão do Pipeline: mostrar a tarefa com horário certo de Brasília e o nome "Tarefa".
5. Corrigir qualquer erro que aparecer nesses testes e apagar o cliente de teste no final.

## Detalhes técnicos
- Abas em `useMinhasTarefas.ts` (comparação por `vence_em` em BRT) — mantidas.
- Destaque: `TarefaRow.tsx`, comparando `vence_em`+`hora_vencimento` com agora em -03:00.
- Teste via Playwright com lead de teste, limpeza de tarefas/atividades/histórico/avisos ao final.
- Sem mudança no banco.
