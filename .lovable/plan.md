# Lead do site: nomes da campanha e do anúncio no lugar dos números

Desenho: mockup-veio-do-site-nomes.png (aprovar antes do plano).

## O que muda para o corretor
- Quadro "Veio do site": "Como chegou" mostra a rede (Instagram/Facebook/Google) e linhas novas "Campanha" e "Anúncio" com os nomes do Meta.
- "Pesquisou" só aparece quando for palavra de verdade; número de anúncio nunca aparece ali.
- Se o nome ainda não foi carregado do Meta: "Campanha do Meta (nome ainda não carregado)", nunca o número.
- Histórico do lead: "Lead do site — Instagram · nome da campanha" no lugar do código.

## Não muda
Distribuição, Roleta, gatilhos, rastreamento, dados gravados do lead.

## Detalhes técnicos
- Fonte dos nomes: `midia_criativos` (campaign_id/ad_id → campaign_name/ad_name), já existente (conferido: 120252489170700030 → "Orygem - Natal | VM").
- Nova RPC só leitura `site_nomes_anuncio(p_lead_id)` (SECURITY DEFINER, mesmo controle de acesso de `ler_dados_site_lead`), devolvendo nomes para utm_campaign/utm_content/utm_term numéricos. 1 migration.
- `src/lib/siteOrigem.ts`: tratar utm numérico como ID (não como termo nem nome); testes em `siteOrigem.test.ts`.
- `VeioDoSite.tsx` + linha do histórico usam os nomes.
- Validação: preview em lead de teste, computador e 390px.
