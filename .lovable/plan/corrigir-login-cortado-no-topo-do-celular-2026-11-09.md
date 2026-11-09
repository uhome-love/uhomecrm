# Corrigir login cortado no topo do celular

## Problema
No iPhone (app instalado na tela inicial), o relógio/bateria ficam por cima do logo "HomeSales." e do Homi, porque o topo do login não reserva o espaço da barra de status.

## O que muda
- O cabeçalho azul-claro do login no celular passa a começar abaixo da barra de status: logo, "com Homi IA" e o Homi descem o suficiente para não ficarem embaixo do relógio.
- O fundo azul-claro continua indo até a borda do topo (sem faixa branca).
- Computador e restante da tela ficam iguais.

## Validação
- Conferir no celular (390px) simulando a área da barra de status e no computador.

## Detalhes técnicos
- `AuthBrandPanel.tsx` (header mobile): trocar `pt-7`/altura fixa por `padding-top: calc(env(safe-area-inset-top) + 1.75rem)` e altura `calc(184px + env(safe-area-inset-top))`.
- Conferir `viewport-fit=cover` no `index.html` (necessário para o `env()` funcionar).
