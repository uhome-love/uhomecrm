# Tarefas — últimos testes da auditoria

## Já testado e aprovado
- Criar tarefa ("+ Nova tarefa" com atalhos de data), anotação pessoal.
- Abas Vencidas / Hoje (com "atrasada") / Próximas / Concluídas.
- Concluir pela página Tarefas, pela ficha do cliente e pelo botão "Registrar" do cartão no Pipeline (sempre exige contato + observação).
- Próxima tarefa com nome do cliente e "Próxima ação" atualizada, horário certo de Brasília.
- Testado com conta de CEO e de corretor.

## O que ainda falta testar
1. **Aviso na hora da tarefa**: criar uma tarefa de teste para daqui a poucos minutos e confirmar que chega o aviso no sininho (e push, se o aparelho estiver com notificações ligadas) — e que chega só uma vez.
2. **"Clientes sem próximo passo"**: clicar em "Criar tarefa" num cliente da lista e confirmar que ele sai da lista depois. Uso só o cliente de teste.
3. **Visão do gerente**: abrir a página Tarefas como gerente, escolher um corretor do time e confirmar que vê as tarefas dele só para leitura (sem botão Concluir).
4. **Celular**: abrir a página Tarefas e a janela de concluir em tela de celular e conferir que nada fica cortado.
5. Corrigir o que der errado, testar de novo e apagar o cliente de teste e os avisos no final.

## Detalhes técnicos
- Item 1: forçar uma execução da função `tarefa-aviso-horario` com o segredo do cron em vez de esperar a próxima conferência de 15 min; conferir `notifications` (tipo `tarefa_horario`, sem duplicar pelo `agrupamento_key`).
- Item 3: precisa de uma sessão de gerente no preview (o sistema entra com a conta que você estiver usando no preview).
- Testes com Playwright; nada de clientes reais é alterado.
