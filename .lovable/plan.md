# Agenda de Visitas — StatCard com tons semânticos

## Estado atual verificado

- `src/components/ui/StatCard.tsx` **não existe** — o piloto foi revertido.
- `src/pages/AgendaVisitas.tsx` está na versão antiga: cabeçalho manual (título + botões inline, sem `PageHeader`) e os 5 KPIs inline com `border-l-[3px]` colorido, incluindo um hex hardcoded `text-[#6366f1]` / `border-l-[#6366f1]` no card "Criadas".
- `src/components/ui/PageHeader.tsx` existe e já suporta `title`, `subtitle`, `icon`, `actions`.
- Tokens `--success-500`, `--warning-500`, `--danger-500`, `--primary` existem em `index.css` (claro e escuro).

Ou seja: além de adicionar os tons, é preciso **recriar** o StatCard e **reaplicar** o cabeçalho novo — não é só ajuste de cor.

## 1. Criar `src/components/ui/StatCard.tsx`

Componente novo com as props:

- `label` (string), `value` (string | number), `sub?`, `delta?` (número com sinal, verde/vermelho), `accent?` (fundo sutil `bg-primary/[0.03]`), `active?` (anel indigo `ring-2 ring-primary/30`), `onClick?`, `className?`
- **nova** `tone?: "neutral" | "primary" | "success" | "warning" | "danger"` (default `"neutral"`)

Comportamento:

- Base: `bg-card border border-border rounded-[12px] p-3 text-left transition-all`, número em `text-[22px] font-[800] tracking-[-0.5px] tabular-nums`, label `text-[10px] uppercase text-muted-foreground`.
- `tone !== "neutral"`: o **número** recebe `text-success-500` / `text-warning-500` / `text-danger-500` / `text-primary`, e o card ganha acento `border-l-[3px] border-l-<tom>` mantendo a borda base.
- `tone === "neutral"`: número em `text-foreground`, sem borda esquerda extra.
- `accent` e `tone` coexistem: `accent` só pinta o fundo sutil; a cor do número vem sempre do `tone`.
- Com `onClick` renderiza `<button>` com `aria-pressed={!!active}` e hover; sem `onClick` renderiza `<div>` estático.
- Mapa de tons via objeto de classes literais (sem string dinâmica), 100% tokens — nenhum hex.

## 2. Atualizar `src/pages/AgendaVisitas.tsx`

- Substituir o cabeçalho manual pelo `PageHeader` (título "Agenda de Visitas", subtítulo com contagem/período, ícone `CalendarDays`, `actions` = botões Google Agenda / Nova Visita / pendentes). As linhas de busca e filtros continuam abaixo, inalteradas.
- Substituir o bloco inline dos KPIs por 5 `StatCard`, mantendo o grid `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2`:
  - Criadas → `tone="primary"`, estático (remove o hex `#6366f1`)
  - Marcadas → `tone="warning"`, `onClick` filtro `marcadas`, `active`
  - Realizadas → `tone="success"`, `onClick` filtro `realizadas`, `active`
  - No-show → `tone="danger"`, `onClick` filtro `no_show`, `active`
  - Taxa de comparecimento → `accent` + `tone="primary"`, estático
- Toda a lógica de `kpiFilter`, badges de filtro ativo, períodos, listas e diálogos permanece exatamente como está.

## 3. Confirmação de escopo

Somente estes 2 arquivos serão tocados:
- `src/components/ui/StatCard.tsx` (novo)
- `src/pages/AgendaVisitas.tsx`

Nada de sidebar, tema, `index.css`, `tailwind.config.ts`, outras páginas, banco, edge functions. Sem publicar/deploy.

## 4. Riscos

- **Reversão anterior**: como o piloto sumiu do repositório, o cabeçalho precisa ser reintroduzido; se você preferir manter o cabeçalho atual e mudar só os KPIs, é só avisar — reduzo o escopo.
- **Cabeçalho**: mover os botões para `actions` do PageHeader muda levemente o espaçamento/quebra em telas pequenas; valido no preview em mobile e desktop.
- **Contraste do amarelo**: `warning-500` em números grandes no tema claro é legível, mas menos que verde/vermelho; se ficar fraco, ajusto para o mesmo token com peso maior (sem criar cor nova).
- **Tailwind**: classes de tom serão literais no código para não quebrar o purge.
- Nenhum risco de dados — mudança 100% de apresentação.
