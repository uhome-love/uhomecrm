# Fase 6 — Aba "Meta do mês" no PDN

Objetivo: dar ao gestor/CEO uma visão de meta vs. realizado do mês, por corretor e no consolidado da empresa, dentro da própria página do PDN. Sem novas tabelas — usa `empresa_metas_mensais` e `corretor_metas_mensais` que já existem.

## O que muda

### 1. Terceira view no toggle: Planilha / Kanban / **Meta**
`PdnHeader.tsx` ganha o botão "Meta". Mantém o estado atual do mês selecionado.

### 2. Novo componente `PdnMetaMes.tsx`
- **Card Empresa (topo)**: meta_vgv (empresa_metas_mensais) vs. realizado (Σ vgv onde grupo='ganho' e !caiu). Progress bar + gap + %.
- **Grid de corretores**: 1 card por corretor com meta_vgv (editável inline pelo gestor/CEO), realizado (ganhos), em contrato (informativo), gap, %, progress bar.
- Ordenação padrão: maior gap primeiro (quem precisa de atenção).
- Corretores sem meta cadastrada aparecem no fim com CTA "Definir meta".

### 3. Novo hook `useMetasMes(mes)`
- `SELECT * FROM empresa_metas_mensais WHERE mes=$1` → 1 linha (ou null).
- `SELECT user_id, meta_vgv FROM corretor_metas_mensais WHERE mes=$1` → mapa por user_id.
- `upsertEmpresaMeta(valor)` e `upsertCorretorMeta(user_id, valor)` — RLS já protege (só admin/gerente escreve).
- Refetch após save (optimistic update leve).

### 4. Cálculo de realizado (por corretor)
Reaproveita `PdnRow[]` que já vem carregado em `PdnGestor`:
- realizado = Σ vgv onde `corretorAuthId === user_id`, `grupo==='ganho'`, `!caiu`.
- contratos = Σ vgv onde `corretorAuthId === user_id`, `grupo==='contrato'`, `!caiu`.
- Se `corretorAuthId` for null (linha manual), agrupa por nome como fallback.

### 5. Permissão de edição
- CEO / admin / diretor: edita meta empresa + qualquer corretor.
- Gerente: edita só corretores da equipe dele (mesma regra já usada em `showEquipeFilter`).
- Corretor comum: view-only (aliás essa página inteira já é gestão).

## Arquivos afetados

- `src/hooks/pdn/useMetasMes.ts` — novo.
- `src/components/pdn/PdnMetaMes.tsx` — novo (< 300 linhas).
- `src/components/pdn/PdnHeader.tsx` — adiciona 3º toggle "Meta".
- `src/pages/PdnGestor.tsx` — renderiza `<PdnMetaMes>` quando `view === 'meta'`; some com toolbar/kpi neste modo (toolbar de filtro não faz sentido em Meta).

## Backend

Zero mudança. Tabelas e RLS já existem.

## Fora de escopo (Fase 7+)

- Permissões finas (gerente x diretoria x CEO) — Fase 7.
- Alerta automático quando corretor está <50% da meta com poucos dias no mês — Fase 8.

## Validação ponta-a-ponta

1. Abrir /pdn → botão "Meta" aparece no header ao lado de Planilha/Kanban.
2. Trocar para "Meta" → card empresa + grid de corretores renderiza; realizado bate com o KPI "Ganhos" da Fase 2.
3. Editar meta de um corretor → salva; refetch reflete o novo valor sem recarregar.
4. Trocar mês → recalcula meta e realizado do novo mês.
5. Typecheck limpo; `PdnMetaMes.tsx` < 300 linhas.
