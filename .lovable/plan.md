

## Alinhar botões do card — espaçamento uniforme

O problema: o botão Tarefa está dentro de um `<div style={{ flex: 1 }}>` wrapper + o Popover, enquanto Ligar e WhatsApp são botões diretos com `flex: 1`. Isso causa larguras desiguais.

### Mudanças

**CardActionBar.tsx** — padronizar o padding do botão Ligar e WhatsApp para `8px 4px` (já está) e garantir que o `minHeight: 36` está em todos. Atualizar o wrapper do Tarefa (linha 59) para incluir `alignItems: "center"` e `justifyContent: "center"`.

Mais importante: o padding do botão Tarefa no `CardQuickTaskPopover.tsx` está com `6px 4px` enquanto os outros estão com `8px 4px`. Padronizar para `8px 4px`.

**Edições concretas:**

1. **`CardQuickTaskPopover.tsx` linha 110** — trocar `padding: "6px 4px"` → `padding: "8px 4px"`

2. **`CardActionBar.tsx` linha 59** — o wrapper `<div>` do Tarefa já tem `flex: 1, minWidth: 0, display: "flex"`. Não precisa mudar — o botão interno já tem `flex: 1, width: "100%"` que preenche corretamente.

Resultado: os 3 botões (Ligar, Tarefa, WhatsApp) terão exatamente o mesmo `flex: 1`, `padding: 8px 4px`, `fontSize: 11`, `fontWeight: 600`, `minHeight: 36` — ficando perfeitamente alinhados e com a mesma largura.

### Arquivos
- `src/components/pipeline/CardQuickTaskPopover.tsx` (1 linha)

