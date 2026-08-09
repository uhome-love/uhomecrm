# Performance — refatoração completa (dados + visual + visões)

Objetivo: uma única página de Performance, bonita e densa no padrão do Dashboard CEO, com números que fecham com as outras telas do CRM e três leituras claras (CEO, Gestor, Corretor).

---

## 1. O que está errado hoje (verificado na base)

**Presença 26%**
O cálculo é `dias presentes ÷ (dias úteis do mês inteiro × todos os corretores da lista)`. Em agosto isso divide os 265 dias de presença já registrados por 21 dias úteis × ~48 corretores — mesmo estando só no dia 9 e mesmo contando corretores inativos e quem nunca teve registro. Resultado: percentual sempre baixo e sem significado.

**Visitas totais menor que realizadas**
Hoje "totais" conta visitas *criadas* no período e "realizadas" conta visitas *ocorridas* no período. Uma visita criada em julho e realizada em agosto entra só em realizadas — por isso o total fica menor.

**VGV gerado**
Hoje soma o valor de todos os negócios *criados* no período, incluindo os que já caíram. Não é "negócio em contrato ativo".

---

## 2. Novas definições (o que cada número passa a significar)

| Número | Definição nova |
|---|---|
| Presença | Dias em que o corretor esteve na empresa ÷ dias úteis **já decorridos** do período. Denominador só com corretores **ativos**. Mesma fonte da página Presença (registros de presença diária), com faltas e saídas visíveis. |
| Leads recebidos | Leads que entraram para o corretor no período (sem mudança). |
| Visitas totais | Toda visita que **existiu no período** — agendada nele ou realizada nele, sem duplicar. Nunca menor que as realizadas. |
| Visitas realizadas | Visitas ocorridas no período (sem mudança). |
| Negócios abertos | Negócios criados no período (sem mudança). |
| VGV gerado | Valor dos negócios **ativos** — em negociação e em contrato — excluindo os que caíram. |
| VGV assinado | Regra atual de fonte única (data de assinatura + rateio 50/50). Inalterada. |
| Pipeline ativo | Foto de agora: leads do corretor fora de venda/descarte/caiu. |
| Descartes | Leads descartados dentro do período. |

Cada card de KPI ganha um ícone de ajuda com essa explicação em uma linha, para ninguém mais precisar perguntar de onde vem o número.

---

## 3. Organização da página (três visões)

Uma página, um só motor de dados; muda o escopo e o nível de detalhe.

**CEO / Diretor** — tudo. Barra de período (dia · semana · mês · personalizado) + filtro de equipe e corretor.
1. **KPIs** — 7 cartões com variação vs. período anterior, funil visual e sinais de atenção.
2. **Planilha do funil** — todos os corretores agrupados por equipe.
3. **Conversão** — taxas lead→visita, visita→negócio, negócio→venda.
4. **Rankings** — leads, visitas e VGV, com pódio.

**Gestor** — mesma estrutura, escopo travado na própria equipe, sem seletor de equipe. Ranking mostra a posição da equipe no geral.

**Corretor** — só os próprios números: KPIs, sua linha do funil, sua conversão e sua posição nos rankings (sem ver a planilha do time).

**Limpeza:** as abas **Comercial** e **Resultado** saem do seletor. Os relatórios que viviam nelas ficam acessíveis pelos atalhos existentes; a Performance passa a ter só Visão Geral, Equipe e Meus resultados.

---

## 4. Planilha do funil — o que muda no visual

- Equipes em blocos **colapsáveis**, com linha de total por equipe e total geral fixo no rodapé.
- **Ordenação por coluna** (clique no cabeçalho) dentro de cada equipe e no modo lista plana.
- Alternador **"Agrupar por equipe" / "Lista única"**.
- Cabeçalho e coluna do corretor fixos na rolagem, avatar + nome, zebra sutil, números alinhados à direita e tabulares.
- Barras de intensidade discretas nas colunas de volume e semáforo mantido só na presença.
- Exportação PDF/HTML respeita exatamente o que está na tela (filtro, ordenação, agrupamento).

---

## 5. Detalhes técnicos

- Atualizar `public.rpc_perf_funil`:
  - `presenca_dias` e novo `dias_uteis_decorridos` (limitado a hoje em BRT, feriados fora); expor também faltas e saídas.
  - `visitas_agendadas` vira `visitas_total` = distintas com criação **ou** realização no período.
  - `vgv_gerado` passa a somar negócios com fase em negociação ou contrato (exclui caídos), em vez de todos os criados.
  - Manter presença/pipeline/descartes atribuídos apenas à linha de equipe atual, como já é hoje.
- `src/hooks/useFunilPerformance.ts`: novos campos, `presencaPct` com denominador de dias decorridos × corretores ativos.
- `src/components/performance/v3/PerfHome.tsx`: rótulos, tooltips de definição, remoção do rodapé redundante.
- `src/components/performance/v3/FunilTable.tsx`: reescrita com ordenação, colapso por equipe e cabeçalho fixo.
- `src/components/central-v2/unifiedSections.ts`: remover as visões `comercial` e `resultado` e apontar aliases das seções antigas para as que permanecem.
- `src/lib/performanceReport.ts`: acompanhar as novas colunas.

Migration: uma só (substituição da função), fora do horário de pico conforme a regra de migrations.

---

## 6. Ordem de execução e validação

1. Mockup visual da nova Performance (KPIs + planilha) para aprovação.
2. Migration da RPC + conferência dos números contra a página Presença, a Agenda de Visitas e Vendas Realizadas.
3. Frontend: KPIs → planilha → conversão → rankings.
4. Validação ao vivo no preview nas três visões (CEO, gestor, corretor), período dia/semana/mês/personalizado, e exportação.
