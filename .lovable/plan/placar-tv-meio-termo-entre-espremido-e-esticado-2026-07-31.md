# Placar TV — meio-termo entre "espremido" e "esticado"

## O que está acontecendo

Hoje o palco tem altura elástica (acompanha o formato da TV) e escala 100% pela largura. Numa TV mais "baixa" o palco vira 1920 x ~1100+, e como o conteúdo é uma coluna flexível, os blocos (cards de equipe, ranking) esticam para preencher — daí o excesso de espaço vazio dentro dos cards que aparece na foto.

Antes, escalando pelo menor lado, ficava tudo pequeno com faixas pretas. Os dois extremos são os dois modelos já testados.

## O que será feito (meio-termo)

1. **Voltar ao palco de proporção fixa 1920x1080** — o conteúdo volta a ter a densidade original desenhada, sem esticar.
2. **Escala híbrida**: em vez de `min(largura, altura)` (encolhe demais) ou só largura (estica demais), usar a média entre as duas: `escala = (escalaLargura + escalaCabe) / 2`. Resultado: ocupa quase toda a largura, sem miniaturizar e sem esticar.
3. **Recorte controlado**: se o palco escalado passar levemente da altura da tela, ele fica centralizado e o excedente é cortado só nas bordas (margens já vazias), em vez de encolher tudo.
4. **Ajuste fino mantido**: `/placar-tv?scale=0.95` (ou `1.05`) continua funcionando para calibrar cada TV.

## Validação

Capturar `/placar-tv` no preview em 1920x1080, 1600x900, 1366x768 e 1280x720: sem faixas grandes, sem espaços vazios dentro dos cards, ranking legível e as linhas visíveis.

## Detalhes técnicos

- Arquivo único: `src/components/oferta-ativa-ao-vivo/PlacarTv.tsx`.
- `STAGE_H` volta a ser constante 1080; remover o cálculo elástico de `stage.h`.
- `scale = ((w/1920) + Math.min(w/1920, h/1080)) / 2 * scaleAdjust`.
- Wrapper externo continua `fixed inset-0 overflow-hidden` com o palco centralizado.
- Nenhuma regra de dados, pontuação ou RPC muda.
