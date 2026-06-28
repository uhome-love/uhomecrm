## Auditoria do Pipeline (desktop, logado)

Conferi em 1024/1280/1366/1440/1600/1920px, com sessão real:

- **Inteligência → Funil**: OK, zero overflow em todas as larguras.
- **Inteligência → Radar**: OK, zero overflow em todas as larguras.
- **Drawer de detalhe do lead**: 1 bug de layout a corrigir.

## O bug

Na coluna esquerda do drawer (`DrawerLeadInfo`, 36% / max 440px), em **viewports de 1024–1536px** o conteúdo transborda o painel e é **cortado na divisória** com a coluna direita (Histórico):

- Botões de ação "WhatsApp"/"Anotar" cortados.
- Linha de métricas (Tentativas · Na etapa · Últ. contato) cortada.
- Card de empreendimento e texto da "Próxima ação" cortados.

Medições no DOM (getBoundingClientRect):

```text
viewport  painel(px)  grade-ações(px)   estado
1280       322          474             corta ~150px
1366       344          474             corta ~150px
1440       363          474             corta ~110px
1600       403          362             OK (cabe)
1920       440          399             OK (cabe)
```

A grade de ações fica "presa" em ~474px independente do painel ser menor — então é clipada pelo `overflow-hidden` do container pai.

### Causa raiz

A coluna esquerda usa o **Radix `ScrollArea`**. O viewport interno do Radix aplica `display: table` no wrapper de conteúdo, o que faz o conteúdo assumir sua **largura preferida (max-content ≈ 474px)** em vez de respeitar 100% da largura do painel. Como o painel encolhe abaixo de ~474px (larguras de laptop), o conteúdo vaza e é cortado.

## Correção

Arquivo único: `src/components/pipeline/drawer/DrawerLeadInfo.tsx`.

Trocar o `ScrollArea` do Radix por um container de rolagem nativo que respeita a largura do painel:

- Substituir `<ScrollArea className="flex-1 min-h-0">` por um `<div>` com `flex-1 min-h-0 overflow-y-auto overflow-x-hidden`.
- Garantir que o wrapper interno do conteúdo use `w-full min-w-0` para que botões/grades encolham (em vez de `min-width: auto`).
- Atualizar o `useLayoutEffect` de `resetKey`: hoje ele zera o scroll buscando `[data-radix-scroll-area-viewport]`; passar a usar um `ref` direto no novo `div` de rolagem (`scrollRef.current.scrollTop = 0`).
- Remover o import não usado de `ScrollArea`.

Resultado esperado: em qualquer largura ≥768px o conteúdo da coluna esquerda encolhe para caber no painel (com `truncate`/`line-clamp` já existentes nos filhos), eliminando o clipping. Rolagem vertical preservada; nada muda no mobile (a coluna esquerda já fica oculta `hidden md:flex`) nem na coluna direita/abas.

## Validação

Após a mudança, reabrir o drawer via Playwright logado em 1024/1280/1440/1920px e confirmar via DOM que `grade.right <= painel.right` (sem clipping) e que a rolagem vertical continua funcional. Typecheck deve passar.

## Escopo

- Não altera Funil, Radar, Kanban, Equipes, nem a coluna direita do drawer.
- Não toca em backend, RLS, edge functions ou dados.
- Mudança puramente de apresentação, isolada em `DrawerLeadInfo.tsx`.
