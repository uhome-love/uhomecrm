Corrigir o header do PDN que fica sobreposto durante o scroll.

## Problema
O header da página PDN (`src/components/pdn/PdnHeader.tsx`) usa `sticky top-0 z-30`, então ao rolar a página ele permanece fixo na parte superior e cobre o conteúdo que passa por "baixo" dele. Isso está atrapalhando a visualização dos cards/grupos da planilha.

## Solução
1. Em `src/components/pdn/PdnHeader.tsx`, remover as classes `sticky top-0 z-30` do container principal do header, transformando-o em um bloco estático que rola junto com a página.
2. Manter as classes de estilo visuais (`border-b`, `bg-background`, `shadow-sm`, `px-4`, etc.) para preservar a aparência.
3. Ajustar, se necessário, os margens negativas (`-mx-4 md:-mx-6`) para que o header continue alinhado com o container da página.

## Escopo
Apenas ajuste de layout/CSS no componente `PdnHeader.tsx`. Nenhuma mudança de dados, estado, backend ou comportamento funcional.

## Validação
Após a alteração, abrir a página `/pdn` e rolar para baixo. O header deve sair da tela junto com o conteúdo, sem permanecer fixo na frente.