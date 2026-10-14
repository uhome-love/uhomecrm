# Tarefas compactas na lateral da Minha rotina

## O que muda
- Sai o quadro grande "Minhas tarefas de hoje" do meio da página. A Saúde da carteira volta a ficar logo abaixo da barra da roleta, como era antes.
- Na coluna da direita, dentro do quadro "Sua fila de hoje" (logo acima de "Abrir Agenda"), entra uma faixa pequena **Tarefas**:
  - 3 etiquetas clicáveis: **vencidas** (vermelho), **hoje** (azul), **sem passo** (laranja). Todas levam para a página Tarefas.
  - Só a próxima tarefa de hoje, com horário, título e "Concluir" (abre a mesma janela de sempre: contato + observação).
  - "Ver todas →" leva para a página Tarefas.
  - Se não houver tarefa hoje, a linha da tarefa some e ficam só as etiquetas.
- A linha atual "30 atrasados · 2 tarefas hoje" sai, porque os números passam para as etiquetas (não repete a informação).
- No celular aparece do mesmo jeito, dentro do mesmo quadro.

## Como vou validar
- Foto da Minha rotina no computador e no celular com o acesso de corretor.
- Concluir a tarefa pela faixa nova usando um cliente de teste e conferir que foi para a história; depois apago tudo.

## Detalhes técnicos
- `MinhasTarefasHojeCard.tsx` vira versão compacta (`variant` embutido, sem borda própria) e é renderizado dentro do `AgendaResumoWidget`, substituindo a linha de resumo de atrasados/hoje.
- Remover `<MinhasTarefasHojeCard />` da coluna principal de `CorretorDashboard.tsx`.
