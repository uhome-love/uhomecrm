## Diagnóstico

Inconsistência entre o badge "Fila CEO" (mostra 1) e o conteúdo do modal (mostra 0 em todas as 3 abas).

**Causa raiz — divergência de filtros entre as duas queries:**

- Badge (`src/pages/CeoDashboard.tsx` linha ~175, `loadFilaCeo`):
  ```
  pipeline_leads
    .select(count) head:true
    .eq("aceite_status", "pendente_distribuicao")
    .is("corretor_id", null)
  ```
  → **não filtra `arquivado`**

- Modal (`src/components/pipeline/FilaCeoDispatchModal.tsx` linha ~130):
  ```
  pipeline_leads
    .select(...)
    .is("corretor_id", null)
    .eq("aceite_status", "pendente_distribuicao")
    .eq("arquivado", false)
  ```
  → **exclui arquivados**

**Confirmado no banco:** existe exatamente 1 lead nesse estado (`Graciela`, id `11ff2633…`, criado 22/05, `arquivado=true`). Ele é contado pelo badge mas filtrado pelo modal — daí 1 vs 0.

Comportamento correto: lead arquivado não deve aparecer na fila de distribuição. O modal está certo, o badge está errado.

## Correção

Arquivo único: `src/pages/CeoDashboard.tsx`

Na função `loadFilaCeo`, adicionar `.eq("arquivado", false)` na query do `countRes` para alinhar exatamente com o filtro do modal:

```ts
supabase
  .from("pipeline_leads")
  .select("id", { count: "exact", head: true })
  .eq("aceite_status", "pendente_distribuicao")
  .is("corretor_id", null)
  .eq("arquivado", false),
```

Nenhuma outra alteração. Sem migration, sem mexer no lead Graciela (fica arquivado como está — auto-archive Descarte 24h ou inativação manual já tratou).

## Critérios de aceite

1. Badge "Fila CEO" no `/ceo` mostra **0** (não 1) com o estado atual do banco.
2. Botão "Fila CEO" fica desabilitado quando count=0 (já é o comportamento via `disabled={filaCeoCount === 0}`).
3. Quando entrar um lead novo `pendente_distribuicao` + `corretor_id null` + `arquivado=false`, badge e modal mostram o mesmo número.
4. Build limpo, zero TS errors.

## Fora de escopo

- Não tocar em segurança (backlog separado).
- Não refatorar o hook `loadFilaCeo` nem o modal.
- Não criar migration nem mexer no registro do lead Graciela.