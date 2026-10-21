# Tarefas no celular (mockup aprovado)

## O que muda (só no celular)
1. **Topo grande**: "Tarefas" com resumo "3 atrasadas · 5 para hoje"; botão "+" para nova tarefa; gestor mantém o seletor "Minhas / time / corretor".
2. **Seletor em duas opções**: "Minhas" | "Concluídas". Junto, um chip "Sem próximo passo" quando houver.
3. **Busca** em caixa cinza arredondada.
4. **Lista única agrupada**: Atrasadas (vermelho), Hoje (azul), Novas (se houver) e Próximas (fechada, abre ao tocar no "8 ›").
5. **Cartão novo**: círculo à esquerda (tocar = Concluir), nome do cliente, tarefa, chip do empreendimento, horário à direita. Tocar no cartão abre o cliente por cima, como hoje.
6. **Deslizar para a esquerda**: botões WhatsApp e Adiar. Adiar oferece Amanhã / 2 dias / Próxima semana e só muda a data da tarefa.
7. **Concluir**: abre a mesma janela de hoje (que já sobe de baixo), com as mesmas regras: tipo de contato + observação obrigatória, e criar a próxima.

## O que não muda
- Computador: tela atual intacta.
- Regras de concluir, histórico, aviso na hora, visão do gestor (só leitura, sem deslizar nem concluir).

## Validação
Conta de corretor em iPhone (393px), com tarefa de cliente de teste: agrupamento, busca, abrir cliente e cancelar, adiar, concluir com observação; apagar o cliente de teste no fim. Conferir computador igual.

## Detalhes técnicos
- Novo `src/components/tarefas/mobile/`: `TarefasMobileView.tsx` (agrupa a partir de `separarAbas`, mesma fonte), `TarefaCardMobile.tsx` (swipe com pointer events, translateX, sem lib nova), `AdiarSheet.tsx`.
- `TarefasCorretor.tsx`: `useIsMobile()` escolhe entre a view mobile e a atual; estado/handlers (concluir, drawer, criar, recarregar) continuam no page e são passados por props.
- Adiar: `update pipeline_tarefas set vence_em` (data BRT via `hojeBRT`), mesmo padrão do concluir de anotação; mantém `hora_vencimento`.
- Tokens semânticos (destructive/primary/muted), sem cor fixa. Sem banco.
