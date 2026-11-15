# Rastreamento completo dos leads do site

## O que encontrei (lead Vitória, hoje 13h56)
Os dados chegaram, mas ficaram escondidos num texto de observação e não viram informação útil na ficha:
- Origem: **Pop-up de Saída** (janela que aparece quando a pessoa vai sair do site), celular
- Página: **busca** de apartamento/garden/cobertura/casa/sobrado em **Auxiliadora, Higienópolis, Bela Vista, Petrópolis, Três Figueiras**, **2 quartos, 1 vaga, até R$ 300 mil**
- Produto e formulário ficaram vazios porque ela não estava num imóvel específico

## O que vai mudar
1. **Quadro "Veio do site" na ficha do lead** (topo do Resumo), sempre que o lead vier do site:
   - Onde clicou (Pop-up de saída, Botão WhatsApp, Formulário do imóvel, etc.)
   - Página em que estava (link clicável)
   - Imóvel/código, quando houver
   - **Interesse declarado** lido da busca: tipo, bairros, quartos, vagas, faixa de preço
   - Aparelho (celular/computador) e campanha do Google/Meta, se houver
2. **Interesse preenchido automaticamente**: lead de busca sem imóvel ganha "Interesse declarado: apto 2q até R$ 300 mil — Auxiliadora, Petrópolis…" em vez de ficar vazio (mesma regra já usada no WhatsApp).
3. **Corrigir os leads antigos do site** sem essas informações (últimos 90 dias), com anotação no histórico. Corretor e etapa não mudam.
4. **Padrão para o site**: entregar ao site um ajuste para enviar também os filtros da busca e o nome do formulário de forma separada (não só dentro do link), garantindo que nunca chegue lead sem origem.

## Ordem (seu fluxo obrigatório)
Mockup do quadro → sua aprovação → construir → validar ao vivo no computador e celular 390px com a Vitória.

## Detalhes técnicos
- Fonte: `pipeline_leads.dados_site` (origem_componente) + `observacoes` (Página/Device); `receive-landing-lead` passa a gravar `pagina_url`, `filtros_busca`, `formulario` estruturados em `dados_site`.
- Função pura `src/lib/siteOrigem.ts` (parse da URL `/busca` e `/imovel/...`, rótulos de componente) com testes.
- Backfill só UPDATE de `empreendimento` quando vazio (texto "Interesse declarado: …", sem tocar `campanha` para não disparar re-rotulagem errada) + anotação.
