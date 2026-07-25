## Bug: botão "⚙️ Configurações" não abre no /oferta-ativa-ao-vivo

### Causa provável
Em `src/pages/OfertaAtivaAoVivo.tsx`, o handler `setView` faz:

```tsx
const setView = (v: View) => setParams((p) => {
  if (v === "corretor" && !isManagerish) p.delete("view");
  else p.set("view", v);
  return p; // ← mesma instância de URLSearchParams
});
```

Retornar a mesma instância de `URLSearchParams` é um problema conhecido do React Router v6: como a referência não muda, o roteador pode não atualizar a URL/estado, e a aba não troca. Isso explica por que clicar em "⚙️ Configurações" (e no botão "Ir para Configurações" da tela vazia) não faz nada.

Um segundo problema, cosmético mas real: a barra de abas `flex flex-wrap justify-end` empurra o botão "Configurações" para a borda direita e, em viewports estreitas (~1378px), o botão fica cortado / meio fora da tela.

### Correção (mínima e isolada ao arquivo `src/pages/OfertaAtivaAoVivo.tsx`)

1. Criar uma nova instância de `URLSearchParams` no `setView`:
   ```tsx
   const setView = (v: View) => setParams((prev) => {
     const next = new URLSearchParams(prev);
     if (v === "corretor" && !isManagerish) next.delete("view");
     else next.set("view", v);
     return next;
   });
   ```
2. Ajustar a barra de abas para não cortar botões em telas médias: trocar `justify-end` por `justify-end` com `overflow-x-auto` OU simplesmente permitir wrap real (`flex flex-wrap justify-end gap-2` já existe — o problema é o item cortado). Alternativa mais segura: aplicar `min-w-0 shrink-0` nos botões e permitir wrap; se ainda estourar, usar `overflow-x-auto` no container.

### Validação
- Recarregar `/oferta-ativa-ao-vivo` como Lucas (CEO/Admin).
- Clicar em "⚙️ Configurações" → URL deve ir para `?view=config` e renderizar `AdminSessaoPanel`.
- Clicar em "Como corretor" e "Painel Ao Vivo" → continuar alternando corretamente.
- Sem sessão ativa, clicar em "Ir para Configurações" → mesma navegação.
- Redimensionar até ~1200px → nenhum botão da barra deve ficar cortado / fora da área clicável.

### Escopo
- Apenas frontend, apenas `src/pages/OfertaAtivaAoVivo.tsx`. Nada de backend, RLS, edge functions ou lógica de sessão.