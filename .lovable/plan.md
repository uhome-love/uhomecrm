## Objetivo

Separar conceitualmente **Negócios Caídos/Perdidos** dos negócios ativos. Hoje, quando um negócio "cai", ele vira `fase = distrato` mas continua com `status = ativo`, então fica poluindo o board de negócios. A correção:

- **Caiu = Perdido** → sai do pipeline de negócios e vai para uma base/aba "Caídos" (exibida em cinza, "já perdido").
- **Distrato** (desfazer contrato já assinado) → fica para depois, não será implementado agora.
- Os **115 negócios** hoje em `distrato` serão migrados para a nova base de Perdidos.
- Relatórios **não** contam perdidos como negócio ativo (a view `v_kpi_negocios` já classifica `distrato/perdido/cancelado` como `conta_perdido`, então isso já está coerente).

```text
ANTES                                  DEPOIS
┌───────── Board de Negócios ─────────┐   ┌───────── Board de Negócios ─────────┐
│ Novo · Proposta · Negoc · Contrato  │   │ Novo · Proposta · Negoc · Contrato  │
│ Vendido · [Caiu]  ← polui aqui      │   │ Vendido                             │
└─────────────────────────────────────┘   └─────────────────────────────────────┘
                                              + Aba "Caídos" (cinza, fora do ativo)
```

## Mudanças

### 1. Migração de dados (negócios existentes)
- `negocios` com `fase = 'distrato'` e `status = 'ativo'` → `fase = 'perdido'`, `status = 'perdido'`.
- `negocios` arquivados em `fase = 'distrato'` → `fase = 'perdido'` (mantém `status = 'arquivado'`).
- Resultado: nenhum negócio perdido continua como `ativo`, então saem do board automaticamente.

### 2. `src/hooks/useNegocios.ts`
- `NEGOCIOS_FASES`: remover a coluna `distrato` (Caiu). O board fica com: Novo Negócio, Proposta, Negociação, Contrato Gerado, Vendido.
- Carregamento: hoje filtra só `status = 'ativo'`. Passar a carregar também `status = 'perdido'` (para alimentar a aba Caídos), expondo um seletor para separar ativos × perdidos.
- `moveFase`: quando a fase destino for `perdido`, gravar também `status = 'perdido'` (sai do ativo).

### 3. `src/pages/MeusNegocios.tsx`
- Adicionar alternância no topo: **Pipeline** (board atual, só ativos) e **Caídos** (lista de perdidos).
- O board (`negociosByFase` + render das colunas) usa apenas negócios ativos.
- Aba **Caídos**: lista os perdidos em estilo "esmaecido" (cinza, opacidade reduzida, badge "Perdido"), mostrando cliente, imóvel, motivo da queda e data — somente leitura/consulta.
- Ação "Negócio caiu" (`handleQueda`) e a transição passam a mover para `perdido` (não mais `distrato`). Mantém o registro do motivo em `negocios_atividades` e a opção de devolver o lead ao Pipeline de Leads.
- `PHASES_WITH_POPUP` e a lógica de destino trocam `distrato` por `perdido`.

### 4. Ajustes de referências a `distrato` → `perdido`
Atualizar os pontos que disparam/rotulam "Caiu" para usar `perdido`, mantendo `distrato` reconhecido apenas em listas de agrupamento de "perdidos" (compatibilidade com histórico):
- `src/components/negocios/NegocioCard.tsx` (ação mover para caiu).
- `src/components/pipeline/FaseTransitionModal.tsx` (campos da transição de queda).
- `src/components/relatorios/RelatorioVendas.tsx` e `RelatorioNegocios.tsx` (rótulos/cores).
- `src/components/relatorio/GerarManualTab.tsx` (cálculo de perdidos — incluir ambos).
- `src/lib/metricDefinitions.ts`: `NEGOCIO_FASES_PERDIDO` mantém `['perdido','cancelado','distrato']` para não quebrar histórico.

## Detalhes técnicos
- A view `v_kpi_negocios` já trata `perdido` como perdido (não conta como venda/proposta), então os relatórios continuam corretos sem alteração de SQL além da migração de dados.
- Nenhuma rota nova é criada; a base de Caídos é uma aba dentro de `/negocios` (MeusNegocios).
- Sem alteração no fluxo de Vendido nem na criação de negócios.

## Fora de escopo (combinado)
- Implementar o "Distrato" como ação no negócio Vendido — fica para uma etapa futura.
- Depois disto, retoma-se o **passo 3** da Fase 2 (unificação dos cabeçalhos de página).