## Fix
Em `src/components/pipeline/header/PipelineGestorSelect.tsx`, linha 16, trocar:

```
{ id: "b3a1c3a4-f109-40ae-b5d4-15eff3a541ab", nome: "Gabriel Bergamo", apelido: "Gabriel" },
```

por:

```
{ id: "b3a1c3a4-f109-40ae-b5d4-15eff3a541ab", nome: "Gabriel Vieira", apelido: "Gabriel" },
```

Apelido permanece "Gabriel" (não há colisão). Nenhum outro arquivo precisa mudar — `GERENTES_REAIS` é exportado daqui e consumido por `PipelineKanban` e `PipelineScopeBadge`, que só leem `nome`/`apelido` dinamicamente.

## Risco
Zero — string-only, sem mudança de UUID nem de shape.
