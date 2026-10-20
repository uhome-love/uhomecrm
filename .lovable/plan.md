# Painel do CEO no celular volta ao visual anterior

## O que muda
- No celular, o Painel do CEO volta a mostrar a mesma tela de antes do redesenho, igual à do computador. Isso inclui o topo, os indicadores, as seções e as tabelas, tudo como era.
- Sai o visual novo: indicadores deslizáveis, blocos expansíveis e cartões por equipe.

## O que continua igual
- A barra de botões embaixo (Painel, Pipeline, +, Tarefas, Mais) e o menu Mais.
- As abas "Visão geral" e "Performance da Roleta".
- Os números, as ações (aprovar credenciamento, Fila CEO, detalhamentos) e a tela do computador.
- As demais telas do celular já redesenhadas.

## Validação
- Abrir o Painel em tamanho de iPhone e conferir que está igual à versão anterior, sem rolagem lateral quebrando a página e com a barra de baixo funcionando.
- Conferir que o computador segue idêntico.

## Detalhes técnicos
- `src/pages/CeoDashboard.tsx`: renderizar sempre `DesktopDashboardContent` e não passar `mobileHeader` ao `PainelComAbas`.
- Os componentes mobile do painel ficam no código, sem uso, para reverter rápido se quiser voltar ao visual novo.
- Atualizar a memória "Painel CEO no celular aprovado" para registrar que o visual novo foi revertido a pedido.
