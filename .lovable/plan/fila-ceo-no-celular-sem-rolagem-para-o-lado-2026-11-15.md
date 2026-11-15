# Fila CEO no celular: sem rolagem para o lado

## O que muda (só visual)
- O título de cada grupo (ex.: "Apartamento Adaptado para PNE – Novo, Pronto para Morar...") deixa de cortar a lateral: quebra em até 2 linhas e termina com "..." se ainda for maior. Toque/mouse em cima mostra o nome completo.
- Emoji repetido no começo do nome do imóvel sai do título (já tem o ícone de prédio).
- A janela inteira passa a caber na largura da tela: texto "Distribua leads...", abas Novos/LIA, aviso de domingo/feriado e os botões de destino quebram linha em vez de sair pela direita.
- Etiquetas do lead (site_uhome, fila_ceo_site) descem para a linha de baixo quando não cabem.
- Interesse do site continua no formato curto já aprovado ("Interesse: Apto Auxiliadora até 300mil").
- Nada muda na distribuição, nos dados ou no computador (lá só ganha a mesma quebra de linha se precisar).

## Validação
- Celular 360, 390 e 440px e computador 1280px, com a Fila CEO aberta, conferindo que não há rolagem lateral.

## Detalhes técnicos
- `FilaCeoDispatchModal.tsx`: `DialogContent` com `w-[calc(100vw-1rem)] sm:max-w-2xl` e filhos com `min-w-0`; título do grupo `line-clamp-2 break-words` no lugar de `truncate`, cabeçalho `items-start`; descrição/aviso com `break-words`; remover emoji inicial via regex só na exibição.
