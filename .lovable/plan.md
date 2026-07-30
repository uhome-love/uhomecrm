# Performance — hub único (reorganização do menu)

Hoje a página `/central-relatorios` mostra **15 abas em linha** (Visão Geral, Pipeline, Origem & ROI, Oferta Ativa, Tempo de Resposta, Visitas, Negócios, Vendas, Metas, Coorte, Forecast IA, Ranking, Relatório por equipe, Meu Progresso, Relatório 1:1). Isso gera scroll horizontal e nenhuma hierarquia de uso.

## O que está duplicado (verificado no código)

- **Pipeline**: a seção é só um bloco de KPIs de funil (`SectionPipelineLeads`), os mesmos indicadores que a Visão Geral já resume. → absorver na Visão Geral.
- **Origem & ROI**: usa `rpc_metricas_origem` (leads/visita/venda/VGV por campanha). A Central de Marketing (aba Rastreamento & Funil) já entrega isso com muito mais profundidade (criativo, conjunto, formulário, investimento). → sai da Performance; fica um card de atalho "Ver na Central de Marketing".
- **Oferta Ativa**: **não é duplicado** — é relatório analítico (`get_relatorio_oferta_ativa`), enquanto `/oferta-ativa` é operação. Mantém, mas dentro do grupo Comercial.
- **Origem & Segmento (legado)**: `SectionOrigemSegmento` ficou órfã depois do alias `origem-segmento → origem`. → remover o arquivo morto.

## Nova estrutura: 5 visões + seletor de sub-visão

Barra de navegação com **5 chips** e, à direita, um **Select** com as sub-visões da visão ativa (só aparece quando há mais de uma).

```text
[ ícone ]  Performance
           Resultado, funil e equipe · fonte única de verdade
 ┌───────────────────────────────────────────────────────────────┐
 │ ● Visão Geral  Comercial  Resultado  Equipe  Meus resultados  │   [ Sub-visão ▾ ]  [ Período ▾ ]  [ PDF ]
 └───────────────────────────────────────────────────────────────┘
```

| Visão | Sub-visões |
|---|---|
| Visão Geral | — (KPIs SSOT + funil + KPIs de Pipeline absorvidos + atalho p/ Central de Marketing) |
| Comercial | Tempo de Resposta · Visitas · Oferta Ativa |
| Resultado | Negócios · Vendas · Metas vs. Realizado · Coorte & Retenção · Forecast IA |
| Equipe | Ranking · Relatório por equipe |
| Meus resultados | Meu Progresso · Relatório 1:1 (corretor vê só esta + Visão Geral) |

## Identidade única do hub

- Título da página passa a ser **Performance** (hoje ainda diz "Central de Relatórios"), igual ao item do menu lateral.
- Um único cabeçalho: título + chips + sub-visão + filtro de período + exportar, sempre na mesma linha visual — o `CentralHeader` interno deixa de repetir título/filtros soltos abaixo.
- Mesmo padrão visual em todas as seções: chip de ícone, título display, subtítulo (padrão `SectionHeading`), cards com o mesmo raio/borda e rodapé "Fonte: …" mantido.

## Detalhes técnicos

- `src/components/central-v2/unifiedSections.ts`: trocar `UNIFIED_GROUPS` por `UNIFIED_VIEWS` (5 visões, cada uma com `ids` de sub-seções e sub-seção padrão); remover `pipeline-leads` e `origem` da lista de seções; ampliar `SECTION_ALIASES` para que URLs antigas (`?secao=pipeline-leads`, `?secao=origem`, `?secao=origem-segmento`) continuem abrindo (Visão Geral / Central de Marketing).
- `src/pages/CentralRelatorios.tsx`: renderizar chips de visão + `Select` de sub-visão; a URL continua sendo a fonte de estado (`?secao=`), derivando a visão ativa a partir da sub-seção; renomear título/aria para "Performance"; guarda de papel (corretor) preservada.
- Absorver os KPIs de `SectionPipelineLeads` na Visão Geral (SSOT) sem criar consulta nova — reaproveitando a query já existente do motor `central`.
- Excluir `src/components/central-v2/sections/SectionOrigemSegmento.tsx` e a rota interna correspondente.
- Sem mudanças de banco, RPC ou lógica de cálculo: apenas navegação, layout e remoção de duplicidade.

## Validação

Abrir `/central-relatorios`, percorrer as 5 visões e todas as sub-visões, conferir que cada bloco carrega os mesmos números de hoje, testar URLs antigas e exportar PDF em uma seção de cada motor.
