# Incluir Alvorada na busca de imóveis do CRM

## O que muda

Hoje o filtro de cidade da busca de imóveis oferece apenas 5 opções: Porto Alegre, Canoas, Cachoeirinha, Gravataí e Guaíba. A base tem 121 imóveis em Alvorada que ficam invisíveis nessa busca.

A mudança adiciona "Alvorada" à lista de cidades permitidas, passando a aparecer:
- no dropdown de cidade da página de imóveis;
- na sugestão de busca por texto (autocomplete);
- nos resultados/mapa filtrados por cidade.

## Detalhe técnico

- `src/utils/imoveisFormat.ts`: incluir `"Alvorada"` em `CIDADES_PERMITIDAS` (a coordenada de Alvorada já existe no mapa de bairros/cidades, então o pin do mapa já funciona).
- Nenhuma alteração de banco, RLS ou edge function. Nenhuma outra tela é afetada — a constante só é usada em `ImoveisPage.tsx` e no shim `siteImoveis.ts`.

## Validação

Abrir a busca de imóveis, conferir "Alvorada" no dropdown de cidade, selecionar e confirmar que os imóveis de Alvorada aparecem na lista e no mapa.
