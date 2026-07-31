# Placar TV — mesmo visual em qualquer televisão

## Por que numa TV fica espaçoso e na outra apertado

O placar hoje é montado direto no tamanho da tela (`100vh` + grades que esticam), mas boa parte dos elementos tem tamanho fixo em pixels (fontes 9–26px, avatares 40–56px, paddings). Ou seja:

- Numa TV que reporta 1920x1080 CSS px, tudo cabe folgado.
- Numa TV que reporta menos área útil (muitas Smart TVs/navegadores reportam 1280x720 ou aplicam overscan/densidade própria), a área encolhe mas os textos e avatares continuam do mesmo tamanho em pixels → o conteúdo ocupa proporcionalmente muito mais espaço e fica espremido, com linhas cortadas.

Tirar zoom não resolve porque zoom no navegador muda o CSS px do viewport e alguns tamanhos são `clamp(...vw...)` e outros fixos — a proporção quebra ainda mais, não escala junto.

## Correção proposta

Transformar o placar num "palco" de tamanho fixo (1920x1080) que é escalado inteiro por `transform: scale()` para caber na tela real, centralizado. Assim:

- O layout é sempre exatamente o mesmo em qualquer TV, monitor ou notebook — só muda o tamanho.
- Nada mais fica apertado nem estoura: escala proporcional única.
- Zoom do navegador deixa de importar; a TV pode ficar em 100%.

Detalhes:
- Fator de escala calculado por `min(larguraTela/1920, alturaTela/1080)`, recalculado em `resize`.
- Fundo preto/gradiente preenchendo as bordas quando a proporção da TV não for 16:9 (letterbox discreto).
- Ajuste fino opcional por URL: `/placar-tv?scale=0.95` para compensar overscan de TVs que cortam as bordas.

## Validação

Abrir `/placar-tv` no preview e verificar em 1920x1080, 1366x768 e 1280x720: layout idêntico, sem cortes, sem barra de rolagem. Depois conferir nas duas TVs físicas.

## Detalhes técnicos

- Arquivo único alterado: `src/components/oferta-ativa-ao-vivo/PlacarTv.tsx`.
- Envolver o conteúdo atual num wrapper externo (`position: fixed; inset: 0; overflow: hidden`) contendo um palco `width: 1920px; height: 1080px; transform: scale(k); transform-origin: center`.
- O container interno troca `height: 100vh` por `height: 100%` do palco; nenhuma outra regra de estilo, dado ou lógica de pontuação muda.
