## Objetivo

Hoje a página **Vendas Realizadas** só permite ver vendas de um mês específico. Vamos adicionar uma alternância **Mês / Ano**, para que CEO, gerente e corretor possam ver o total de vendas do ano inteiro (ou ainda de um mês, como já funciona).

O controle de quem vê o quê (CEO vê tudo, gerente vê o time, corretor vê só as próprias vendas + parcerias) **já existe e continua valendo** — só muda o intervalo de datas consultado.

## O que muda na tela

1. **Novo botão de período** ao lado do seletor de mês, com duas opções: **Mês** e **Ano**.
   - Em **Mês**: comportamento atual (seleciona o mês via popover).
   - Em **Ano**: o seletor de mês fica oculto e a página passa a somar de 1º de janeiro a 31 de dezembro do ano corrente.
2. **Subtítulo do cabeçalho** reflete o período: `Maio 2026` (mês) ou `Ano de 2026` (ano).
3. Todos os blocos abaixo se atualizam automaticamente porque já consomem o mesmo intervalo de datas:
   - KPIs (Vendas, VGV total, Ticket médio, Corretagem)
   - Estimativa de comissão
   - Ranking por corretor
   - Aba Origens & Campanhas

Nenhuma mudança de banco de dados é necessária.

## Detalhes técnicos

Arquivo único: `src/pages/VendasRealizadas.tsx`

- Adicionar estado `periodMode: "mes" | "ano"` (default `"mes"`).
- Ajustar o `useMemo` de `dateRange`:
  - `ano` → `start = YYYY-01-01`, `end = YYYY-12-31`, `label = "Ano de YYYY"`.
  - `mes` → lógica atual.
- A `queryKey` já inclui `dateRange.start`/`dateRange.end`, então a query refaz sozinha ao trocar de período.
- No `PageHeader.actions`, colocar um pequeno toggle (dois botões ou `Tabs`) **Mês / Ano**; manter o popover de mês visível apenas quando `periodMode === "mes"`.

### Observações
- A query anual de VGV por corretor (faixa de comissão) já usa o ano inteiro, então as faixas 32/34/36% continuam corretas.
- Nada muda nas permissões por papel — apenas o intervalo de datas.

## Estimativa
~20–30 min, baixo risco (frontend isolado em um arquivo).