# "Veio do site" mostra tudo o que o site já envia

## O que muda na ficha do lead (caixa "Veio do site")
- **Fonte**: usa o nome que o site já manda pronto (ex.: "Google Ads — Natal", "Acesso direto"). Só cai no cálculo atual quando o site não mandar.
- **Palavra pesquisada no Google** (quando vier).
- **Visitas ao site**: data da 1ª visita, nº de visitas e tempo no site.
- **O que olhou**: últimos imóveis vistos, favoritos e buscas feitas (até 3 de cada, com "+N").
- **Selos**: "Conversou com a LIA" e "Cliente que voltou".
- **1ª página aberta** (de onde entrou) junto da página do envio.
- Cada linha só aparece se o dado existir; lead antigo continua igual.

O histórico do lead também ganha essas linhas (fonte, palavra, nº de visitas), sem mexer em etapa, corretor ou distribuição.

## Limpeza
Excluir o lead de teste "TESTE rastreio" (criado hoje 14:44) e o histórico dele.

## Validação
Antes de excluir, abrir a ficha do "TESTE rastreio" no computador e no celular (390px) e conferir a caixa. Depois excluir e confirmar que sumiu.

## Ressalva
Hoje o lead de teste traz só fonte, código do Google, formulário, páginas e nº de visitas. Imóveis vistos, favoritos, buscas, tempo e LIA ainda não vieram em nenhum lead; a tela fica pronta e mostra quando o site começar a mandar.

## Detalhes técnicos
- `src/lib/siteOrigem.ts`: ler `dados_site.fonte`, `utm_term`, `landing_url` e `contexto.rastreamento.*` (`numero_visitas`, `primeira_visita`, `tempo_site*`, `imoveis_vistos`, `favoritos`, `buscas`, `conversou_lia`/`lia`, `retorno`), aceitando nomes alternativos; testes novos com o JSON real do teste.
- `VeioDoSite.tsx`: novas linhas/chips.
- `fn_site_resumo` (função SQL do histórico): incluir fonte enviada, palavra e nº de visitas — 1 migration.
- Exclusão do lead de teste via consulta direta (dado, não estrutura).
