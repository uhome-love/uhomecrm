# Som de Natal também na visita marcada (Placar da TV)

## O que acontece hoje
No Placar, a visita **realizada** toca a música de Natal. Para a visita **marcada** já existe um som de Natal pronto: sinos tilintando seguidos de um "Ho ho ho!". Esse som não toca porque a tela do Placar não está ligada a ele. Quando a tela tenta tocar e não encontra o som, ele não sai, e o que se ouve é o som comum.

## O que será feito
- Ligar o som de Natal da visita marcada (sinos + "Ho ho ho!") na tela do Placar.
- A visita realizada continua com a música de Natal atual.
- Depois da campanha, o Placar volta automaticamente aos sons normais, como já acontece hoje.
- Nada muda em contagens, pontos ou visitas. É só o som.

## Validação
Abrir o Placar no computador e no celular, simular um aviso de visita marcada e um de visita realizada, e conferir que os dois tocam o som de Natal sem nenhum erro na tela.

## Detalhes técnicos
- `src/pages/PlacarDoDia.tsx`: acrescentar `tocarVisitaMarcadaNatal` no import de `@/natal/PlacarNatal`. Hoje a chamada na linha 167 dá ReferenceError, e o `try/catch` esconde o erro.
- Nenhuma mudança em `src/natal/`.
