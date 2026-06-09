## Problema
No drawer de detalhe do lead, o nome do empreendimento (ex: "Belíssima Sala Comercial no Centro Histórico") está com `truncate` (uma linha + corte), o que está estourando/cortando a visualização do card.

## Solução
Em `src/components/pipeline/drawer/DrawerEmpreendimento.tsx`, no `<div>` do título do empreendimento:
- Trocar a classe `truncate` por quebra de linha em até 2 linhas: `line-clamp-2 break-words leading-tight`.

Isso faz o texto longo quebrar em duas linhas em vez de cortar, mantendo o card e o lead totalmente visíveis.

### Detalhe técnico
Linha atual:
```tsx
<div className="text-[13px] font-semibold text-foreground truncate">
```
Passa a:
```tsx
<div className="text-[13px] font-semibold text-foreground line-clamp-2 break-words leading-tight">
```

Nenhuma mudança de lógica — apenas apresentação.