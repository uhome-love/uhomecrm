# Correção: itens de gestão do time "sumidos" no menu do gerente

## O que encontrei (abri o CRM como Gabriel Vieira)
- O perfil dele está certo (gerente) e o menu **tem** o grupo "Time" com Usuários, Meus Candidatos, Presença, Foco Corretores e Relatórios.
- O problema é de tela: com a Campanha Natal e o Mutirão ao vivo entrando no menu, a lista ficou mais comprida que a tela. Em notebook, o grupo "Time" fica **cortado no rodapé** (só aparecem "Usuários", "Meus Candidatos" e "Presença"; Foco Corretores e Relatórios ficam escondidos).
- O menu até rola, mas a barra de rolagem está **invisível**, então não dá para perceber que existe mais coisa embaixo.
- Além disso, "Meu time" foi renomeado para "Usuários", o que confunde o gerente.

## O que vou fazer
1. **Menu mais compacto:** itens um pouco mais baixos e espaçamentos menores entre grupos, para caber o menu inteiro do gerente numa tela de notebook comum.
2. **Rolagem visível:** barra fina aparece ao passar o mouse, e uma sombra suave no rodapé indica que há mais itens embaixo.
3. **Nome de volta:** para o gerente, o item volta a ser **"Meu time"** (CEO/diretora continuam vendo "Usuários").
4. **Celular:** conferir o menu lateral do celular do gerente com a mesma regra.
5. Nada de permissão, equipe ou dado muda.

## Como vou conferir
- Entrar como Gabriel Vieira em 1366x768, na tela dele (1713x841) e no celular: todos os itens do grupo "Time" visíveis ou alcançáveis rolando, e cada um abre a página certa.
- Entrar como CEO e corretor: menu continua igual em conteúdo, sem quebra.

## Detalhes técnicos
- `src/components/layout/Sidebar.tsx`: reduzir altura de item (h-9 → h-8) e paddings de grupo; trocar `scrollbarWidth: none` por scrollbar fina no hover + gradiente de "tem mais" no rodapé; label `/meu-time` do grupo gestor → "Meu time".
- `src/config/pageRegistry.ts` / `src/pages/MeuTime.tsx`: título da aba/página "Meu time" para gestor.
