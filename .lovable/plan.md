# Fix: TaskCompletionDialog cortado em telas menores

## Diagnóstico

Ambos os prints (pipeline e central de tarefas) mostram o mesmo modal "Como prosseguir com este lead?" com o lado direito cortado — "Follow-up" e "E-mail" da grid `grid-cols-3` saem da viewport, e o botão "Concluir e criar próxima tarefa" aparece truncado.

O componente é único: `src/components/pipeline/task-completion/TaskCompletionDialog.tsx` (usado tanto pelo pipeline quanto pela central de tarefas).

Linha 166:
```tsx
<DialogContent className="max-w-[560px] p-0 gap-0 overflow-hidden bg-card border-border text-foreground">
```

Problemas:
1. **Sem `w-` explícito** — base shadcn aplica `w-full`, mas como o modal é posicionado `fixed left-[50%] translate-x-[-50%]` o `100%` depende do containing block. Em telas com layout que gera overflow horizontal no body (sidebar fixa + pipeline largo), o `w-full` calcula a partir do body (não do viewport visível) e o modal renderiza 560px começando fora do centro real → corta à direita.
2. **`overflow-hidden`** — em laptops com altura ~720px, conteúdo do Step 2 (longo: outcome + tipo de ação + quando + mover etapa + detalhes + footer) excede a altura do modal e fica inacessível, sem scroll interno.

## Mudança (1 arquivo, 1 linha)

### `src/components/pipeline/task-completion/TaskCompletionDialog.tsx` — linha 166

**De:**
```tsx
<DialogContent className="max-w-[560px] p-0 gap-0 overflow-hidden bg-card border-border text-foreground">
```

**Para:**
```tsx
<DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-card border-border text-foreground">
```

O que muda:
- `w-[calc(100vw-2rem)]` — largura sempre relativa ao **viewport** (não ao body), com 1rem de margem de cada lado. Garante que nunca corte à direita, independente do que esteja por baixo.
- `max-w-[560px]` — mantém o cap em desktop largo.
- `max-h-[90vh] overflow-y-auto` — substitui `overflow-hidden` para permitir scroll vertical interno quando o conteúdo do Step 2 não couber em laptops baixos.

## Fora de escopo

- Não alterar `CompletionStep1` / `CompletionStep2` — a grid `grid-cols-3` (Ligação / WhatsApp / Follow-up) continua, vai apenas respeitar a largura do container reduzido.
- Não mexer no shadcn `Dialog` base nem em outros modais.
- Não alterar layout do pipeline nem da central de tarefas.

## Validação

1. Abrir o modal no **pipeline** em laptop ~1280x720 → modal cabe inteiro, botões "Follow-up" e "E-mail" visíveis, footer "Concluir e criar próxima tarefa" inteiro.
2. Abrir o modal na **central de tarefas** mesma resolução → mesmo comportamento.
3. Em desktop 1920px → modal centralizado em 560px como antes.
4. Em mobile 440px → modal usa quase toda a largura (~408px), sem corte.
5. Conteúdo do Step 2 com altura grande → scroll vertical interno funcional.
6. Console limpo.

Risco baixo, 1 linha alterada, 1 arquivo.
