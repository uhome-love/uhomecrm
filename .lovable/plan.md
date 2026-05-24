## Causa raiz
O variant `right` do shadcn `Sheet` (sheet.tsx:41) aplica:
```
inset-y-0 right-0 h-full w-3/4 border-l ... sm:max-w-sm
```
O uso atual em `PipelineLeadDetail.tsx:554` é:
```
w-full sm:w-[70vw] sm:max-w-[2000px] p-0 flex flex-col overflow-hidden border-l border-border/50 max-h-[100dvh]
```
Combinando os dois:
- `w-3/4` do variant é sobrescrito por `w-full` (ok em < 640px).
- A partir de `sm:` (≥ 640px) entra `sm:w-[70vw]` e o `sm:max-w-sm` herdado do variant briga com `sm:max-w-[2000px]`. Em viewports entre 640 e 767px o drawer aparece como "ilha" (~384px / 70vw), apesar do `useIsMobile()` considerar isso mobile (breakpoint 768px).
- Faltam também `inset-y-0` e `h-full` explícitos no className para garantir altura total quando o usuário sobrescreve.

## Fix proposto (1 linha, 1 arquivo)
`src/components/pipeline/PipelineLeadDetail.tsx:554`

De:
```
className="w-full sm:w-[70vw] sm:max-w-[2000px] p-0 flex flex-col overflow-hidden border-l border-border/50 max-h-[100dvh]"
```
Para:
```
className="inset-y-0 right-0 h-full w-full max-w-none md:w-[70vw] md:max-w-[2000px] p-0 flex flex-col overflow-hidden border-l border-border/50 max-h-[100dvh]"
```

Mudanças:
1. `sm:` → `md:` em width/max-width — alinha com `useIsMobile` (768px).
2. `max-w-none` explícito — neutraliza o `sm:max-w-sm` herdado do variant na faixa 640–767px.
3. `inset-y-0 right-0 h-full` explícitos — garante posicionamento e altura total no mobile mesmo se a precedência de classes do variant for alterada no futuro.

## Não tocar
- `src/components/ui/sheet.tsx` (componente compartilhado).
- Lógica de tabs, `headerNode`/`bodyNode`, `useIsMobile`.
- Layout desktop (≥ 768px continua 2 colunas + 70vw).
- Fixes anteriores (header fixo, scrollTop, `line-clamp-2` do empreendimento).

## Validação
- iPhone (~390px): drawer 100% largura/altura, 4 tabs (Info ativa).
- Tablet portrait (~700px): 100% largura (antes: ilha).
- Desktop ≥ 768px: 70vw, 2 colunas, 3 tabs.

Risco: muito baixo. Apenas classes utilitárias, sem refactor.