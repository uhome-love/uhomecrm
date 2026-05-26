# Cleanup final Dashboard v4 — deletar tabs órfãs

## A) Verificação prévia (concluída)

Executado:
```
rg "TabAgora|TabProducao|TabPipeline|TabMetas|TeamReportExport" src/ -g '*.ts' -g '*.tsx'
```

Resultado: **apenas auto-referências** (cada `export default function` dentro do próprio arquivo). Nenhum import externo. Seguro para deletar.

```
src/components/gerente/TabAgora.tsx         → self
src/components/gerente/TabPipeline.tsx      → self
src/components/gerente/TabMetas.tsx         → self
src/components/gerente/TabProducao.tsx      → self
src/components/gerente/TeamReportExport.tsx → self
```

## B) Deletar 5 arquivos

- `src/components/gerente/TabAgora.tsx`
- `src/components/gerente/TabProducao.tsx`
- `src/components/gerente/TabPipeline.tsx`
- `src/components/gerente/TabMetas.tsx`
- `src/components/gerente/TeamReportExport.tsx`

## C) Verificação pós-deleção

1. Re-rodar `rg "TabAgora|TabProducao|TabPipeline|TabMetas|TeamReportExport" src/ -g '*.ts' -g '*.tsx'` → esperar zero resultados.
2. Confirmar build limpo (sem warnings de import não resolvido).

## D) Polimento final (somente leitura — sem mudanças)

- Conferir `DashboardHeader` → botão Metas continua acionando `setMetasOpen(true)` em `DashboardV4Page`.
- Conferir `V4PanelAlertas` → clique em corretor segue `navigate("/pipeline", { state: { corretorFilter, view: "modo-time" } })`.
- Conferir consistência visual dos painéis v4 (tipografia, spacing, radius). Reportar inconsistências, sem editar sem aprovação.

## Não tocar

`dashboard-v3/*`, `useDashboardGerenteV3.ts`, RPCs, `pageRegistry`, infra, worker, componentes v4, tipos v4.

## Entregável

Report final com: resultado busca prévia (✓ feito), confirmação deleção, busca pós-deleção, status build, e qualquer warning. Aguardo sua validação visual em `/gerente/dashboard` antes de fechar v4.
