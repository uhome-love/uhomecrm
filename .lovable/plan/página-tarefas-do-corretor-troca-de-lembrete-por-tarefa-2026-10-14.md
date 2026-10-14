# Página "Tarefas" do corretor + troca de "Lembrete" por "Tarefa"

## Faz sentido?
Sim. O CRM já guarda os lembretes como tarefas (a mesma lista de tarefas do lead). Só o nome mostrado na tela é "Lembrete". Hoje existe uma regra de propósito: **concluir um lembrete não conta como atividade e não atualiza o lead**. A mudança mais importante é inverter isso: concluir a tarefa com observação passa a ser uma atividade de verdade no lead.

## Fluxo de ponta a ponta
```text
Lead (card, menu ⋯ ou detalhe) -> "Criar tarefa" (data, hora, o que fazer)
        |
Página Tarefas (menu do corretor)
  Abas: Vencidas | Hoje | Próximas | Novas (criadas nas últimas 24h) | Concluídas
        |
"Concluir" -> janela pede: resultado + observação (obrigatória, mín. 10 letras)
        |
  - grava atividade na linha do tempo do lead ("Tarefa concluída: ... — observação")
  - conta como toque/contato do corretor (atualiza "última ação" do lead)
  - pergunta: "Criar próxima tarefa?"  [Sim -> já abre com o lead preenchido] [Não]
```

## O que muda
1. **Nova página "Tarefas"** no menu do corretor: lista todas as tarefas dele, com contadores por aba, busca por nome do lead, e botões para abrir o lead, WhatsApp e ligar. Gerentes veem só as próprias (sem mudar permissões).
2. **Concluir = atividade**: a observação vai para o histórico do lead, como se ele tivesse registrado uma atividade. A ação "⚡ Registrar" no card, quando há tarefa pendente, continua concluindo a tarefa (mesma regra nova).
3. **Criar outra tarefa ao concluir** (opcional, um clique).
4. **Troca de nome em todos os pontos do fluxo**: "Criar lembrete", "Novo lembrete", "Lembrete criado", "Agendar lembrete", "Tipo de lembrete", aba "📌 Lembretes" no lead, ordenação "Compromisso", resumo da Agenda ("X tarefas hoje"), Fila do dia ("tarefa vencida"), textos do histórico, e cartões do Raio-X ("Tarefas criadas / cumpridas / atrasadas").
5. **Agenda continua** com visitas e fila do dia; o bloco de lembretes sai de lá e vira um atalho "Ver todas as tarefas".

## Fora do escopo
- Não muda distribuição, etapas do lead nem a trava de visita pendente.
- A mensagem de WhatsApp "Lembrete da visita" (script para o cliente) continua com esse nome, porque é para o cliente, não é tarefa.
- Tarefas antigas já concluídas não viram atividade retroativamente.

## Ordem de trabalho (padrão do projeto)
- Fase 0: mockup da página Tarefas e da janela de conclusão para sua aprovação.
- Fase 1: página Tarefas + conclusão gerando atividade + "criar próxima".
- Fase 2: troca de nome em todas as telas.
- Fase 3: teste ao vivo com lead de teste (criar, concluir, conferir histórico) e cancelar.

## Detalhes técnicos
- Sem migration: usa `pipeline_tarefas` (tipo `lembrete` mantido no banco para não quebrar relatórios; só o rótulo muda). Notas pessoais (`anotacao`) seguem como estão.
- `src/lib/completeLeadTask.ts` e `src/lib/taskCompletion.ts`: remover a exceção `ehLembrete` — concluir tarefa com observação chama `registrarToque` e insere em `pipeline_atividades`.
- Nova rota `/tarefas` (página dividida em componentes <300 linhas), hook `useMinhasTarefas` com paginação `.range()` e datas em BRT.
- `CriarLembreteModal` renomeado para `CriarTarefaModal` (textos); `registroLimpo.ts` passa a mostrar "Tarefa" em vez de converter para "Lembrete".
- Raio-X: só rótulos; a lógica de contagem continua igual.
