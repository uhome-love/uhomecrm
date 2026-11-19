# Placar de Natal ajustado para a TV TCL 75"

## O que a foto mostra
- A TV abre o placar como uma tela pequena (cerca de 960 px de largura): a coluna "Últimas visitas" some, as letras ficam miúdas e sobra espaço vazio.
- O nome da equipe do meio (Gabriel) fica escondido atrás das luzinhas de Natal.
- O Top 5 com 4 pessoas fica encostado à esquerda, com um buraco à direita.
- As faixas de baixo (Missão 100 milhões e Prêmio surpresa) ficam apertadas.

## O que vai mudar (só aparência, nenhuma regra ou número muda)
1. **Tela em proporção fixa de TV (16:9)**: o placar passa a ser desenhado sempre no tamanho de uma TV Full HD e é ampliado ou reduzido por inteiro para ocupar a tela toda, sem cortes e sem sobra. Fica igual em qualquer TV, inclusive na de 75".
2. **Coluna "Últimas visitas" volta a aparecer** na TV.
3. **Nomes das equipes sempre visíveis**: as luzinhas descem para a borda e o nome ganha espaço próprio.
4. **Top 5 centralizado**: com menos de 5 pessoas, os cartões ficam centralizados e maiores.
5. **Letras maiores** para leitura a distância (placar das equipes, Top 5, faixas de baixo).

No computador e no celular o placar continua funcionando (no celular, mantém o modo atual de tela pequena).

## Validação
- Captura do preview em 960x540, 1920x1080 e 3840x2160 antes de dizer pronto, e no celular (390 px).
- Depois de publicar, recarregar a página na TV.

## Detalhes técnicos
- `src/pages/PlacarDoDia.tsx`: envolver o conteúdo num palco de 1920x1080 com `transform: scale(min(vw/1920, vh/1080))`, centralizado; manter layout fluido abaixo de 700 px de largura (celular).
- Remover o `@media (max-width:1024px)` que esconde o feed quando no modo palco.
- Ranking: `grid-template-columns: repeat(ranking.length, minmax(0, 220px))` com `justify-content: center`.
- Card da equipe: `paddingTop` para as luzes (12 px) não cobrir o `h2`.
- Arquivo já tem 822 linhas: extrair o feed lateral e o ranking para componentes próprios ao mexer.
