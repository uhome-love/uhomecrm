

## Remover espaço vazio entre conteúdo e botões

### Problema
Há um `<div>` separador redundante (linha 466) com `height: 1px` entre o body e o `CardActionBar`, que já tem seu próprio `border-top`. Isso cria espaço duplicado. Além disso, o padding-bottom do body (`11px`) pode ser reduzido para `8px`.

### Mudanças em `src/components/pipeline/PipelineCard.tsx`

1. **Linha 277** — Reduzir padding-bottom do body de `11px` para `8px`:
   - `padding: "13px 14px 11px"` → `padding: "13px 14px 8px"`

2. **Linha 466** — Remover o `<div>` separador redundante:
   - Deletar `<div style={{ height: 1, background: "#e8e8f0" }} />`

Resultado: o card fica mais compacto, sem espaço fantasma entre conteúdo e botões.

### Arquivos alterados
- `src/components/pipeline/PipelineCard.tsx` (2 linhas)

