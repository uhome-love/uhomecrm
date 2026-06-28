# Limpeza da barra de topo do Pipeline (desktop)

Objetivo: tirar o aspecto "embolado", liberar espaço e manter 100% das funções, com visual moderno e denso (padrão SaaS premium). Só altera `src/components/pipeline/PipelineHeader.tsx` (bloco desktop `lg+`, linhas ~516-760). Mobile/tablet ficam intactos. Nenhuma mudança de lógica/negócio — só apresentação e reagrupamento dos mesmos controles.

## O que muda, item por item

### 1. Selects de escopo (corretor / gestor)
- "Todos os corretores" → rótulo curto **"Corretores"**; "Todos gestores" → **"Gestores"** (quando nenhum selecionado). Quando há seleção, mostra o nome escolhido normalmente.
- Largura reduzida e fixa, alinhados ao lado esquerdo da linha de controles.

### 2. Busca
- Encolhe para um botão/campo compacto: largura menor por padrão (`w-[180px]`), placeholder curto **"Buscar..."**.
- Mantém ícone de lupa, clear (x) e o atalho de digitação. Sem perder função.

### 3. Ordenar
- Vira dropdown **icon-first**: ícone de ordenação + valor atual curto (ex.: só "Atividade"), sem o prefixo "Ordenar:". Menos largura.

### 4. Pílulas de status (Em dia / Sem tarefa / Atrasado / Negócios)
Ideia escolhida — **cluster segmentado compacto**: um único grupo unido (sem 4 cápsulas soltas com borda), cada item = bolinha colorida + número, e o texto ("em dia", etc.) aparece só no item ativo e em tooltip no hover. Isso reduz a largura em ~60% mantendo leitura rápida e o clique-para-filtrar.

```text
Antes:  ( ● 1.350 em dia ) ( ● 295 sem tarefa ) ( ● 576 atrasado ) ( ● 70 negócios )
Depois: [ ●1.350 · ●295 · ●576 · ●70 ]   (rótulo só no ativo + tooltip)
```

Alternativas consideradas (posso trocar se preferir): (a) manter texto só nas pílulas com contagem relevante; (b) um chip-resumo único "Status ▾" que abre popover com as 4 opções. A recomendada é o cluster segmentado por ser a mais rápida de ler sem clique extra.

### 5. Refresh + Selecionar
- Saem da linha como botões soltos e entram num **menu de ações "⋯"** (kebab) à direita: "Atualizar" e "Selecionar" (Selecionar só para admin/Kanban). Refresh também pode virar só ícone discreto se preferir mantê-lo visível — recomendo movê-lo para o ⋯ para limpar.

### 6. Fila CEO
- O bloco "Fila CEO · Filtrar · 🆕 Novos · 🔄 Redistrib" colapsa num **único botão com badge** (ex.: "Fila CEO ⌄" com a soma pendente) que abre um popover compacto com: toggle Filtrar, botão Novos (com contagem) e botão Redistribuição (com contagem). Mantém todas as ações, mas ocupa 1 botão em vez de 4 elementos.

## Layout final (desktop)

```text
Linha 1: [▦ Pipeline · 2221 leads · escopo]   ……   [ cluster de status ]   [Modo Foco] [Novo Lead]
Linha 2: [Corretores▾] [Gestores▾] [+Filtros] [Buscar…]   ……   [Ordenar▾] [Fila CEO ⌄] [⋯]
```

- Espaçamento consistente (`gap-2`), divisores sutis, alturas alinhadas (h-9). Em larguras menores (1280px) tudo continua em 2 linhas sem quebrar, agora com folga.

## Detalhes técnicos
- Arquivo único: `src/components/pipeline/PipelineHeader.tsx`.
- Reusar componentes existentes (`PipelineCorretorSelect`, `PipelineGestorSelect`, `PipelineSortDropdown`, `PipelineFiltroBadges`) — ajustar props/labels e estilos; o cluster de pílulas é um ajuste visual dentro de `PipelineFiltroBadges` (modo compacto).
- Popover/menu via componentes shadcn já no projeto (`DropdownMenu`/`Popover`).
- Sem mudança de estado, handlers ou dados — apenas reorganização visual.
- Validação: typecheck + screenshots em 1280px, 1600px e 1848px para confirmar nada quebrou.

Quer que eu siga com a pílula no formato **cluster segmentado** (recomendado) ou prefere o **chip-resumo "Status ▾"**? Posso ajustar antes de implementar.