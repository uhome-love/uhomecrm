# Visual de Natal mais caprichado

## O que muda
1. **Luzes no topo**: some a faixa azul-marinho chapada. Fica só um fio fino, em curva suave, sobre o fundo claro da página, com lâmpadas pequenas que brilham devagar. Não cobre nada.
2. **Gorro no logo**: maior, encaixado em cima do círculo do logo e inclinado para a direita, como um gorro de verdade. Vale para a barra lateral aberta e fechada.
3. **Cartão "Boa noite, Lucas"**: no Painel CEO, no do gerente e na Minha Rotina, o cartão azul vira azul-noite, com neve suave, detalhes dourados, o contador "Faltam X dias para 18/12" em dourado e o Homi de Noel à direita, igual ao desenho já aprovado. Os botões do cartão continuam no mesmo lugar e funcionando igual.
4. **Neve**: continua como está.

Antes de mexer no CRM, faço uma imagem mostrando o antes e o depois para você aprovar.

## Detalhes técnicos
- `src/natal/natal.css`: `.natal-luzes` com fundo transparente, altura de cerca de 22px e o SVG `luzes_varal_1600` (fio fino); brilho mais suave, respeitando a opção de reduzir movimento.
- `src/components/layout/Sidebar.tsx`: reposicionar e girar o `GorroNatal` (cerca de `w-8`, `rotate-[20deg]`, ancorado no topo do círculo) nos dois modos.
- Saudações do CEO e do gerente: criar um invólucro `SaudacaoNatal` em `src/natal/`, que troca só o fundo e a decoração enquanto `isNatal` e os efeitos estiverem ligados; o conteúdo e as ações existentes ficam iguais. Reaproveitar o estilo da saudação da Minha Rotina.
- Validação: capturas na tela de teste com a data de Natal (CEO, gerente, Minha Rotina, barra lateral aberta e fechada, celular) e conferir que não aparece nenhum erro.
