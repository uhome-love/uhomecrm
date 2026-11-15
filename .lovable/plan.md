# Linha do tempo com a mesma origem da caixa "Veio do site"

## O que encontrei (lead Caroline)
- O texto da linha do tempo foi escrito no momento em que o lead entrou, antes de o site mandar o resto das informações (página, de onde veio). Por isso ficou "não informada pelo site". A caixa ao lado lê os dados atualizados, então mostra "Google orgânico".
- Além disso, os dados mostram que a primeira página dela tinha o código de clique do Google Ads (gclid). Ou seja, ela veio de **anúncio do Google Ads**, não do Google orgânico. A caixa e a linha do tempo precisam reconhecer isso.

## O que vou fazer
1. **Linha do tempo acompanha os dados novos:** quando o site completar as informações do lead depois, o registro "Lead gerado via Site" é atualizado com a origem, página e aparelho certos. Nada é duplicado; só substitui as linhas que estavam "não informada".
2. **Reconhecer Google Ads pela primeira página:** se o código do Google (gclid/gbraid/wbraid ou gad_source) estiver no link da primeira página, a origem vira "Google Ads". Vale para a caixa e para a linha do tempo, pela mesma regra.
3. **Corrigir os leads antigos do site** que estão com "não informada" e já têm os dados: reescrever o texto desse registro de entrada.
4. Testar com a Caroline no computador e no celular.

Não muda distribuição, corretor, etapa nem envio de conversões.

## Detalhes técnicos
- `fn_site_resumo` (SQL) e `classificarFonte` em `src/lib/siteOrigem.ts`: extrair gclid/gbraid/wbraid/gad_source de `landing_url` antes de cair no referrer.
- Trigger AFTER UPDATE OF dados_site em `pipeline_leads`: se existir atividade `tipo='entrada'` com descrição contendo "não informada pelo site", regravar `descricao` com o mesmo montador de `fn_site_registrar_historico` (extrair para função que só devolve o texto).
- Backfill único dos registros de entrada afetados; teste unitário da regra de fonte.
