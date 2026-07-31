# Placar TV — palco que preenche a tela (meio-termo)

## O que está acontecendo

Hoje o placar é desenhado num palco fixo de 1920x1080 e escalado inteiro por `min(largura/1920, altura/1080)`. Numa TV cuja área útil do navegador é mais baixa que 16:9 (barra do navegador, overscan), quem manda é a altura: a escala cai, tudo encolhe junto e sobram faixas vazias nas laterais/topo — exatamente o efeito "pequeno e ruim de ver" da foto.

O modelo anterior (layout fluido) preenchia a tela mas apertava textos. O meio-termo é preencher a largura sempre, e deixar só a altura do palco acompanhar a tela.

## O que será feito

1. **Escala pela largura**: fator = `larguraDaTela / 1920` (não mais o `min` com a altura). A TV passa a usar 100% da largura, sem faixas laterais.
2. **Altura do palco elástica**: em vez de 1080 fixo, o palco passa a ter altura = `1920 x (alturaTela / larguraTela)`, ou seja, o mesmo aspecto da TV. O conteúdo é uma coluna flexível (topo, corpo, rodapé), então ele acomoda a altura sem cortar nem sobrar buraco.
3. **Limites de segurança**: altura do palco travada entre 900 e 1400 px de projeto — evita esmagar (TV muito baixa) ou esticar demais (monitor ultrawide). Se a altura real ainda passar do limite, o palco é centralizado com um leve recorte controlado em vez de encolher tudo.
4. **Ajuste manual mantido**: `/placar-tv?scale=0.95` continua funcionando para TVs com overscan.

Resultado: mesma proporção tipográfica das duas TVs, ocupando a tela inteira, sem miniaturizar.

## Validação

Capturar `/placar-tv` no preview em 1920x1080, 1600x900, 1366x768 e 1280x600 (caso "TV baixa"): em todos, sem faixas vazias, sem barra de rolagem, textos legíveis e ranking com as 8 linhas visíveis.

## Detalhes técnicos

- Arquivo único: `src/components/oferta-ativa-ao-vivo/PlacarTv.tsx`.
- Trocar o `useState`/`useEffect` de `stageScale` por um estado `{ scale, stageH }` calculado no `resize`: `scale = innerWidth/1920 * scaleAdjust`; `stageH = clamp(1920 * innerHeight/innerWidth, 900, 1400)`.
- No wrapper do palco, `height: stageH` (em vez de `STAGE_H` fixo) e `transform: scale(scale)` com `transformOrigin: "center center"`.
- Nenhuma regra de dados, pontuação ou RPC muda.
