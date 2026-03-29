

## Converter CallFocusOverlay para Modal Compacto

### Mudança única — linha 213

Trocar o wrapper externo (linha 213) e o fechamento (linha 453) para usar backdrop + modal centralizado. O conteúdo interno (header, progress, body, footer) permanece idêntico.

**Linha 213** — substituir:
```tsx
<div className="absolute inset-0 z-[9999] bg-background flex flex-col h-full">
```
por dois divs aninhados:
```tsx
<div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
  <div style={{ background: 'var(--background)', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
```

**Linha 261** — body div: manter `flex-1 overflow-y-auto` (já está correto)

**Linha 399** — footer div: adicionar `shrink-0` → `border-t border-border/50 px-5 py-3 space-y-2 shrink-0`

**Linha 453** — fechar os dois divs:
```tsx
    </div>
  </div>
```

### Resumo
- 3 pontos de edição no arquivo (linhas 213, 399, 453)
- Zero mudanças de lógica, fases, scripts ou banco
- Nenhum outro arquivo alterado

