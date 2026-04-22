

## Unificar etapas "Assinado" e "Vendido" no Pipeline de Negócios

Hoje o pipeline de negócios tem duas etapas redundantes — **Assinado** e **Vendido** — que tratam exatamente do mesmo evento (negócio fechado). Isso gera duplicidade no código (`["assinado", "vendido"]` espalhado em 19+ arquivos), confusão visual (CEO/gerente veem "Vendido", corretor vê "Assinado") e a coluna "Vendido" fica oculta para corretores.

### Decisão de unificação

Vamos manter **`vendido`** como a chave canônica única (já tem 40 registros no banco) e eliminar `assinado` por completo.

| Item | Antes | Depois |
|---|---|---|
| Fases no pipeline | Assinado (todos) + Vendido (oculto p/ corretor) | **Vendido** — uma única coluna verde, visível para todos |
| Registros `fase = 'assinado'` | 0 | — |
| Registros `fase = 'vendido'` | 40 | 40 (preservados) |
| Lógica `["assinado","vendido"]` | espalhada | apenas `'vendido'` |

### O que será feito

**1. Banco de dados (migration)**
- Migrar quaisquer `negocios.fase = 'assinado'` para `'vendido'` (segurança — hoje são 0, mas garantimos consistência futura).
- Atualizar a view `v_kpi_negocios`: `conta_venda` passa a checar apenas `fase = 'vendido'`.
- Remover a etapa órfã `Assinado` (`tipo = 'assinatura'`) da tabela `pipeline_stages` (legado não-utilizado pelo módulo de negócios).

**2. Código frontend**
- `src/hooks/useNegocios.ts`: remover entrada `assinado` de `NEGOCIOS_FASES`. Remover `hidden: true` de `vendido` e renomear label para **"Vendido"** com cor verde única (#22C55E).
- `src/pages/MeusNegocios.tsx`: remover a lógica condicional `((isAdmin || isGestor) && f.key === "vendido")` — a coluna passa a aparecer para todos automaticamente.
- `src/components/negocios/NegocioCard.tsx`: mesma simplificação no dropdown "Mover para etapa".
- `src/components/pipeline/NegocioDetailModal.tsx`: trocar `fase === "assinado"` → `fase === "vendido"` (botão Solicitar Pagadoria, botão Regredir).
- `src/components/pipeline/FaseTransitionModal.tsx`: o caminho `targetFase === "assinado"` vira `"vendido"`.
- `src/hooks/useNegocios.ts` (linha 223): o `if (novaFase === "assinado")` que seta `data_assinatura` passa a checar `"vendido"`.

**3. Limpeza de duplicidade em consumidores**
Substituir todas as ocorrências de `.in("fase", ["assinado","vendido"])` por `.eq("fase", "vendido")` nos seguintes arquivos:
- `src/components/relatorios/RelatorioVendas.tsx`
- `src/components/relatorios/RelatorioOrigem.tsx`
- `src/components/relatorios/RelatorioConversao.tsx`
- `src/components/gerente/TabProducao.tsx`
- `src/pages/CheckpointGerente.tsx`
- `src/hooks/useCeoDashboard.ts`
- `src/hooks/useForecast.ts`
- `src/hooks/useVendaRealtimeNotification.ts`
- `src/hooks/useSmartAlerts.ts`
- `src/components/ceo/SaudeOperacao.tsx`
- `src/components/central/FunilContent.tsx`
- `src/pages/VendasRealizadas.tsx` (badge fixo "Vendido")
- `src/lib/metricDefinitions.ts`: `NEGOCIO_FASES_ASSINADO = ['vendido']`
- `supabase/functions/homi-gerencial/index.ts`

### Resultado para o usuário

- **Corretor, Gerente e CEO** veem a mesma coluna **"Vendido"** (verde) no pipeline de negócios.
- Quando um negócio é movido para Vendido, `data_assinatura` é setada automaticamente (mantém regra atual).
- Relatórios de VGV Assinado, Vendas Realizadas e KPIs continuam funcionando — todos contam negócios com `fase = 'vendido'`.
- Sem perda de histórico: 40 negócios atuais permanecem como Vendido.

### Riscos & mitigação

- **Memória "Business Deals rules" (`mem://features/negocios/gestao-e-fechamento-v3`)** menciona "fase Vendido visível para CEOs e Gerentes" — atualizaremos a memória para refletir que agora é visível para todos (incluindo corretores).
- Edge Functions que filtram por `assinado` serão re-deployadas automaticamente.

