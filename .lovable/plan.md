# Lote 1 — Visual A-Safe (padronização visual, zero dado)

## (a) Arquivos que serão tocados

### 1. `src/components/ui/StateWrapper.tsx` (CRIAR)
Casca única de estados de tela, aditiva. API:

```
<StateWrapper
  loading?        // boolean
  error?          // boolean | Error | null
  empty?          // boolean
  stale?          // boolean  -> banner "dados podem estar desatualizados"
  onRetry?        // () => void
  skeleton?       // ReactNode custom; default = grade de <Skeleton/>
  skeletonVariant? // "kpis" | "list" | "page"  (default "page")
  loadingTitle?, errorTitle?, errorDescription?
  emptyIcon?, emptyTitle?, emptyDescription?, emptyAction?
  className?
>{children}</StateWrapper>
```

Precedência: `error` > `loading` > `empty` > conteúdo. `stale` renderiza um banner discreto acima de `children` (não substitui conteúdo).

### 2. `src/pages/CeoDashboard.tsx`
- `MiniKpi` (definido inline, linhas ~71-111) passa a renderizar `StatCard` internamente — **a assinatura do MiniKpi e todas as ~15 chamadas ficam idênticas**, só o corpo muda (mapeia `variant` → `tone`, `delta` → `delta`, `sub` → `sub`, `onClick` → `onClick`). Isso preserva `forwardRef`/tooltips existentes.
  - Ressalva técnica: o `StatCard` atual renderiza `<button>` quando há `onClick` e não repassa `ref`. Para não quebrar os wrappers com `ref`, o `MiniKpi` mantém a `<div ref>` externa e usa o `StatCard` dentro dela, ou passa `onClick` no wrapper. O `StatCard` **não será alterado** neste lote.
  - Delta com seta ▲/▼/→ e regra `invertDelta` são preservados no `MiniKpi` (o `StatCard` só entra como casca de label/valor); onde o formato do `StatCard` não cobre, o `sub` recebe o nó de delta. Sem mudança de valor ou de semântica.
- Trocas de hex por tokens: `bg-[#f0f0f5] dark:bg-[#0e1525]` → `bg-background`; `text-[#a1a1aa]` / `text-[#71717a]` / `text-[#52525b]` → `text-muted-foreground` (e `text-foreground/70` onde hoje é claramente mais escuro); `border-[#e8e8f0] dark:border-white/[0.07]` → `border-border`.
- `negFunnelColors` (cores do funil de negócios) **não muda** — é cor semântica de gráfico.
- `|| 0` e cálculos: intocados.

### 3. `src/components/corretor/CarteiraKpis.tsx`
- `KpiBox` e `KpiBoxAmber` substituídos por `StatCard` (mesmos valores, mesmos `onClick`, mesmos `title`/hints, mesmo grid `grid-cols-2 sm:grid-cols-4`).
- Hex de borda (`#4F46E5`, `#DC2626`, `#22c55e`, `#F59E0B`) e `style={{...}}` inline saem; a cor passa a vir de `tone`. O estado "ativo" do card âmbar vira `accent` + `active` do `StatCard` (aparência equivalente, sem `border 2px` inline).
- `loading ? "—" : value` → `<Skeleton className="h-6 w-12" />` no lugar do valor.
- `data ?? {zeros}` e `logDashboard` intocados.
- Detalhe visual: o acento passa de `border-top 3px` para `border-left 3px` (padrão do `StatCard`). Se preferir manter no topo, avise — aí é preciso adicionar uma prop ao `StatCard` (fora do escopo autorizado).

### 4. `src/pages/CorretorDashboard.tsx`
- Header de saudação: `style={{ background: "linear-gradient(135deg,#4969FF,#7C3AED,#3350E6)" }}` → classe utilitária baseada em tokens (`bg-gradient-to-br from-primary via-primary/90 to-primary`), mantendo `text-primary-foreground` no lugar de `text-white`.
- Sem outras mudanças (blocos, ordem, hooks intocados).

### 5. `src/components/pipeline/PipelineHeader.tsx`
- `bg-[#f7f7fb] dark:bg-[#141e30]` → `bg-muted/40 dark:bg-card`; `border-[#e8e8f0] dark:border-white/[0.07]` → `border-border`; `bg-[#e8e8f0] dark:bg-white/[0.07]` (divisores) → `bg-border`; `text-[#a1a1aa]/#71717a/#52525b` → `text-muted-foreground`.
- Título "Pipeline": alinhar as 3 variantes (mobile/tablet/desktop) para o mesmo `text-[15px] font-bold tracking-[-0.3px] text-foreground` do padrão.
- Pílulas, contagens, filtros, badges de campanha e o verde de "Ganhos": **intocados**.

### 6. `src/components/roleta/corretor/RoletaCorretorView.tsx` — **arquivo extra, precisa da sua autorização**
`src/pages/RoletaLeads.tsx` tem apenas roteamento por papel; o spinner de tela cheia (`<Loader2 className="h-8 w-8 animate-spin">`, linha ~163) está no `RoletaCorretorView`. Proposta: trocar **somente esse spinner de página** por `<StateWrapper loading skeletonVariant="page">`. Os spinners inline de botões/seções (linhas ~245, 414, 422, 497, 543) ficam como estão. Sem sua autorização, `RoletaLeads.tsx` fica sem mudança efetiva.

### Fora do lote (recomendação)
`GerenteDashboard` / `VisitasCard`: deixar de fora. São cards com layout próprio (progresso, listas, alturas) e alinhá-los ao `StatCard` traria risco de regressão de layout sem ganho proporcional neste lote.

## (b) Como o StateWrapper é construído sobre o que já existe
- **loading** → skeletons de `@/components/ui/skeleton` (grades pré-montadas por `skeletonVariant`); `LoadingState` de `screen-states` fica disponível como fallback quando se quer o texto "Carregando..." em vez de skeleton.
- **error** → `ErrorState` de `screen-states`, com `action={{ label: "Tentar de novo", onClick: onRetry }}`.
- **empty** → `EmptyState` de `@/components/ui/EmptyState` (o de ícone em cápsula), com fallback de ícone `Inbox`.
- **stale** → banner novo e pequeno dentro do próprio `StateWrapper` (`bg-warning-500/10 border-warning-500/30 text-foreground`), renderizado acima de `children`.
- Nada é reescrito nem removido: `screen-states` continua funcionando para o Pipeline.

## (c) Mapeamento cor atual → `tone`

CeoDashboard (`MiniKpi.variant` → `tone`):
| variant | tone |
|---|---|
| `default` | `neutral` |
| `highlight` | `primary` |
| `success` | `success` |
| `warning` | `warning` |

CarteiraKpis:
| Card | Hoje | tone |
|---|---|---|
| Para hoje | `#4F46E5` | `primary` |
| Atrasadas | `#DC2626` | `danger` |
| Leads sem tarefa | `#F59E0B` (+bg quando >0) | `warning` (+`accent`/`active` quando >0) |
| Em dia | `#22c55e` | `success` |

Cor de delta (verde/vermelho) e `invertDelta` permanecem exatamente com a regra atual.

## (d) Riscos
- **Densidade/tipografia**: `StatCard` usa `p-3` e valor `22px`; `MiniKpi` usa `p-3.5`/`text-xl` e `KpiBox` `text-2xl sm:text-3xl`. Os números do Dashboard do Corretor ficam visualmente menores. Mitigação: `className` por chamada para preservar a escala atual; valido lado a lado no preview.
- **Acento topo → esquerda** no `CarteiraKpis` (mudança perceptível de estilo).
- **`forwardRef` do MiniKpi**: usado com tooltips/refs no CeoDashboard; o wrapper `<div ref>` é mantido para não quebrar.
- **Tokens vs. hex**: `#f0f0f5`/`#f7f7fb` não têm token idêntico; a aproximação é `bg-background` / `bg-muted/40`. Haverá diferença mínima de tom no claro — em troca de dark mode correto. **Nenhuma alteração em `index.css`.**
- **Responsividade**: `StatCard` é fluido, os grids não mudam; risco baixo, mas valido mobile (390px), tablet e desktop.
- **PipelineHeader** tem 3 variantes por breakpoint — cada troca de hex será replicada nas três; valido as três no preview.

## (e) Confirmação
Nenhum hook, query, RPC, filtro, definição de métrica ou valor será alterado. `|| 0`, `data ?? {zeros}` e o comportamento de "erro vira zero" ficam exatamente como estão — o `StateWrapper` entra apenas como casca e, neste lote, não é ligado a estado de erro real (exceto o loading da Roleta, se autorizado). Sem migration, sem banco, sem deploy, sem sidebar, sem `TabContext`, sem `index.css`.

## Pergunta antes de executar
1. Autoriza incluir `src/components/roleta/corretor/RoletaCorretorView.tsx` (só o spinner de página)?
2. `CarteiraKpis`: aceita o acento passando para a borda esquerda, ou prefere manter no topo (exigiria prop nova no `StatCard`)?
