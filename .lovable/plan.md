# Vitrine: manter todos os imóveis selecionados, mesmo de buscas diferentes

## O que aconteceu
A Rafaela selecionou um imóvel numa busca, depois fez outra busca e selecionou o segundo. O contador mostrava "2 selecionados", mas na hora de criar a vitrine o sistema só pegava os imóveis que estavam aparecendo na tela naquele momento (a busca atual tinha só 1 resultado). Por isso a vitrine saiu com 1 imóvel.

## Correção
- Ao selecionar um imóvel, guardar também os dados dele (código, fotos, preço etc.), não só a marcação.
- Ao criar a vitrine, usar todos os imóveis guardados na seleção, independente da busca atual.
- Ao desmarcar, remover da seleção; ao trocar de filtro, a seleção continua.
- Para a vitrine da Rafaela: como o link já foi enviado, a forma segura é ela criar de novo depois da correção (leva segundos). Não vou alterar a vitrine existente no site.

## Validação
- No preview: buscar um bairro, selecionar 1; buscar outro, selecionar outro; criar vitrine e abrir o link mostrando os 2. Teste sem enviar a cliente.

## Detalhes técnicos
- `src/pages/ImoveisPage.tsx`: trocar `selectedIds: Set<string>` por um `Map<string, item>` (ou manter o Set + um Map paralelo) preenchido em `toggleSelect`; `createVitrine` passa a usar os valores do Map em vez de `imoveis.filter(...)`. O mesmo vale para o botão do celular e o drawer de preview, que chamam a mesma função.
- Sem mudança no backend.
