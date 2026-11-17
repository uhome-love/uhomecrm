# Lead de "captação de imóvel" sem informações (Rafael Gomes)

## O que aconteceu
O Rafael preencheu o formulário de **captação** do site, que é para quem quer anunciar ou vender o próprio imóvel com a Uhome. O site mandou ao CRM só o tipo do formulário ("captacao_imovel"). Não mandou a página, a origem, o imóvel dele nem a mensagem. Por isso a ficha mostra "Origem do tráfego não disponível" e a linha do tempo diz só "captacao_imovel".

## O que vou fazer

1. **Prompt para o projeto do site** (você envia lá): no formulário de captação, mandar ao CRM tipo do imóvel, bairro e cidade, endereço quando houver, valor pretendido, quartos, área, se é venda ou locação, a mensagem livre, a página e o botão onde clicou, e o rastreamento (UTMs, gclid, fbclid, primeira página, aparelho). Os mesmos campos que os outros formulários já enviam.

2. **CRM deixa claro que é um proprietário**:
   - Linha do tempo: "Lead do site — Quer anunciar imóvel" em vez de "captacao_imovel".
   - Caixa "Veio do site": "Onde clicou: Formulário de captação (anunciar imóvel)" e, no "O que procura", trocar por **"Imóvel que quer anunciar"**, mostrando tipo, bairro, valor e mensagem quando o site enviar.
   - Selo "Proprietário · captação" na ficha, para o corretor não tratar como comprador.

3. **Corrigir leads antigos** de captação com o novo texto (sem mudar corretor, etapa nem distribuição).

4. **Testar** com um contato de teste em computador e celular, e apagar o teste depois.

## Precisa da sua decisão
- Leads de captação continuam entrando na Roleta como hoje, ou devem ir para uma pessoa específica (ex.: você ou a equipe de captação)? Por padrão, mantenho como está.

## Detalhes técnicos
- Entrada via `crm-webhook` (tipo `captacao`) e `dados_site.origem_detalhe = captacao_imovel`; campos novos gravados em `dados_site.captacao.*`.
- Rótulo em `src/lib/siteOrigem.ts` + `VeioDoSite.tsx`; texto da entrada em `fn_site_texto_entrada` (migration fora do horário comercial, se necessário).
- Nenhuma mudança em distribuição ou dono do lead.
