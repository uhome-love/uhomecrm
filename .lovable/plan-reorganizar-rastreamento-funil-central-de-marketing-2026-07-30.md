# Reorganizar "Rastreamento & Funil" (Central de Marketing)

## Problema atual

A aba empilha 12 blocos verticalmente, sem hierarquia: auditoria, 8 KPIs, "como o 1º contato foi registrado", 4 tabelas de resumo (campanha, conjunto, plataforma, corretor), criativos, 2 tabelas de persistência, 2 de descarte, o bloco laranja "sem origem" e a tabela detalhada por lead. Cada tabela tem 13 a 17 colunas com scroll horizontal. Não existe filtro, nem ordenação, nem agrupamento — só rolagem. É informação demais na mesma superfície visual, sem prioridade.

## Como fica

A aba passa a ter 3 níveis de profundidade, e não mais um scroll único.

```text
[ Cabeçalho: período + Exportar CSV/PDF ]

[ 4 KPIs grandes ]  Leads · Taxa qualificação · Taxa visita · Vendas (VGV)
                    (linha secundária menor: pendentes, sem registro, tempo 1º contato)

[ Sub-abas ]  Visão geral | Mídia | Time | Qualidade dos dados | Leads

  Visão geral   → funil horizontal (Leads → Qualificados → Visitas → Vendas)
                  + Top 5 campanhas e Top 5 conjuntos (tabela enxuta, 6 colunas)
  Mídia         → campanha, conjunto, plataforma, criativos (expansível)
  Time          → por corretor + persistência da cadência + descarte × tentativas
  Qualidade     → auditoria 1º contato, "como o 1º contato foi registrado",
                  leads sem origem (só admin vê auditoria, como hoje)
  Leads         → tabela detalhada com busca (igual hoje)
```

Dentro de cada sub-aba:

- **Tabelas enxutas por padrão**: colunas essenciais visíveis (chave, Leads, Taxa qualif., Visitas, Taxa visita, Vendas, VGV). Um botão "Mais colunas" revela o resto (desqualificados, pendentes, sem registro, tempos, % por origem de contato).
- **Ordenação por clique no cabeçalho** e **Top N** (10 / 25 / tudo) em cada tabela, com as linhas ordenadas por leads decrescente por padrão em vez de ordem arbitrária.
- **Cards colapsáveis**: cada bloco vira um card com título e seta; blocos de diagnóstico começam fechados.
- **Linha de total fixa** no rodapé de cada tabela de resumo, para conferência rápida.
- Notas explicativas viram **tooltip no ícone de ajuda** ao lado do título, e não texto solto acima da tabela.
- Estados vazios explícitos ("sem dados no período") em vez de o bloco sumir sem aviso.

O CSV e o PDF continuam exportando tudo, independente do que está visível na tela.

## Ordem de trabalho

1. **Mockup HTML** da aba reorganizada (visão geral + uma sub-aba de mídia) para aprovação.
2. Depois de aprovado o mockup, implementação.

## Detalhes técnicos

- Escopo: apenas `src/components/relatorios/RelatorioOrigemPerformance.tsx` (544 linhas) — nenhuma mudança em cálculo, RPC ou dados. `origemPerformanceAgg.ts` permanece intacto; o mesmo `agg` alimenta a nova organização.
- Arquivo será quebrado (regra >500 linhas) em `src/components/relatorios/origem/`:
  `KpiHeader.tsx`, `FunilResumo.tsx`, `ResumoTable.tsx` (com sort + top N + colunas extras), `CriativoTable.tsx`, `PersistTable.tsx`, `DescarteTables.tsx`, `AuditoriaBlock.tsx`, `DetalhadoTable.tsx`, `CollapsibleCard.tsx`.
- Sub-abas em estado local do componente (não altera a URL, que já usa `?aba=` para Rastreamento/Investimento na página pai).
- Export PDF: o `contentRef` da página captura só o DOM visível; para o PDF continuar completo, a exportação renderiza temporariamente todas as sub-abas antes do `html2canvas` e volta ao estado anterior.
- Estilo inline atual mantido (a página inteira usa inline styles), sem introduzir tokens novos.

## Fora de escopo

Nenhuma mudança em métricas, definições, SSOT de visitas/VGV, RPC `get_relatorio_origem_performance` ou na aba Investimento.
