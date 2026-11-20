# Jingle Bells na TV quando marcar visita (Placar do Dia)

## O que muda
- Hoje, no tema de Natal, a visita marcada toca um tilintar curto de sinos e depois o "Ho ho ho!".
- Passa a tocar o trecho conhecido de **Jingle Bells** ("Jingle bells, jingle bells, jingle all the way", ~4 segundos), com som de sino, e em seguida o "Ho ho ho!" que já existe.
- Visita **realizada** continua com o som atual (não muda).
- Se chegarem várias visitas juntas, toca uma vez por anúncio, como já acontece hoje com a fila de anúncios.
- Vale enquanto o tema de Natal estiver ligado (até 31/12). Depois volta ao som normal.

## Som liberado na TV
- Navegadores de TV costumam bloquear som até alguém apertar algum botão. Para garantir que o Jingle Bells toque:
  - aparece um aviso discreto no canto: **"Toque OK no controle para ativar o som"**;
  - ao apertar qualquer tecla do controle (ou clicar), o som fica liberado e o aviso some;
  - se o som já estiver liberado, o aviso não aparece.

## O que não muda
- Contagem de visitas, placar, distribuição e qualquer regra do CRM.
- Visual do placar (só o aviso pequeno de ativar som, quando necessário).

## Validação
- Preview: simular uma visita marcada nova (sem criar visita real) e ouvir a sequência; conferir que realizada não mudou.
- Conferir no celular (390px) que nada quebrou.
- Na TCL: publicar, abrir o placar, apertar OK e aguardar a próxima visita marcada.

## Detalhes técnicos
- `src/natal/PlacarNatal.tsx`: `tocarVisitaMarcadaNatal` passa a tocar a melodia E-E-E / E-E-E / E-G-C-D-E sintetizada com timbre de sino (parciais 1x, 2,76x, 5,4x, decaimento exponencial) e dispara `ho_ho_ho` após o fim da melodia.
- `src/pages/PlacarDoDia.tsx`: criar o `AudioContext` cedo, chamar `resume()` em `keydown`/`click`/`pointerdown`, e mostrar o aviso enquanto `ctx.state !== "running"`.
