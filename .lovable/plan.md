## Investigação SQL — Bug confirmado, query está correta

**Corretor "teste"** (id `488744df-3a7c-4b1f-b8a9-d8e83cb68ab3`) — 4 leads totais, 3 ativos:

| Lead | Stage | Tarefas pendentes |
|------|-------|---|
| Bibiani Botega | Busca | 1 (Follow-up 24/05 10:00) |
| Eduardo | Visita | 1 (Follow-up 24/05 10:00) |
| Willian | Busca | 1 (WhatsApp 24/05 10:00) |
| camila | Descarte | — (excluída pelo filtro stage.tipo) |

**Query SQL idêntica à do código** retorna `sem_tarefa = 0` para o teste. **A query NÃO tem bug.**

Contagens dos 3 corretores confirmadas:
- `488744df-teste` → **0** (esperado, todos têm tarefa futura)
- `cc857f25-Cor1` → **40** (bate com R4)
- `c988f004-Cor2` → **9** (bate com R4)

## Causa raiz: cache stale (não é H1/H2/H3/H4)

`useCorretorHomeData.ts:202-238` define `staleTime: 60_000` na query `["corretor-leads-sem-tarefa", user?.id]`. **Essa queryKey NÃO está no helper `invalidateTaskQueries`** (`src/lib/taskQueryUtils.ts`). Resultado: depois que o corretor cria a 3ª tarefa, o widget continua exibindo o valor antigo (1) por até 60s + qualquer tempo enquanto o componente não remontar.

Mesma classe de bug do **R4.5.1 Issue B** (cache stale silencioso) — só que esta queryKey foi esquecida no helper.

## Plano de fix

### Issue 1 — Adicionar queryKey ao helper centralizado

`src/lib/taskQueryUtils.ts` — incluir `["corretor-leads-sem-tarefa"]` na lista de invalidação. Sem `refetchType: 'all'` (segue padrão do `owned-lead-task-map`: refetcha só observers ativos, suficiente porque o dashboard é a única tela que renderiza esse contador). Isso fecha automaticamente os 5 fluxos já cobertos pelo R4.5.1.

A query em si não precisa mudar — está semanticamente correta e bate com a definição CEO.

### Issue 2 — Segundo botão "Central de Tarefas"

**`src/components/corretor/LeadsSemTarefaCard.tsx`** — adicionar prop `onOpenCentral` e renderizar 2 botões lado a lado (stack em mobile):

- Botão 1 mantém estilo sólido âmbar + ícone `ChevronRight`
- Botão 2 estilo outline âmbar + ícone `ListChecks` (lucide-react)
- `flex-col sm:flex-row gap-2` no container dos botões para responsividade

**`src/pages/CorretorDashboard.tsx`** — passar `onOpenCentral={() => navigate('/tarefas?tab=desatualizados')}`.

**`src/pages/MinhasTarefas.tsx`** — ler `useSearchParams()` no mount; se `tab` ∈ {todas,hoje,amanha,semana,atrasadas,desatualizados,concluidas}, fazer `setActiveTab(tab as TabFilter)`. Também forçar `setCategoria("leads")` quando `tab=desatualizados` (já que essa tab só existe para leads).

### Telemetria

Adicionar fire-and-forget em ambos os cliques via `supabase.from('ops_events').insert(...)`:
```ts
{ fn: 'lead_sem_tarefa_action', level: 'info', category: 'dashboard',
  message: 'click', ctx: { destino: 'modo_foco' | 'central_tarefas', count } }
```
Reusa convenção do `focusTelemetry.ts` (mesmo schema `ops_events`).

## Arquivos a editar (exatos)

1. `src/lib/taskQueryUtils.ts` — +1 linha de `invalidateQueries` na lista
2. `src/components/corretor/LeadsSemTarefaCard.tsx` — adiciona prop + 2º botão + telemetria
3. `src/pages/CorretorDashboard.tsx` — passa o novo handler de navegação
4. `src/pages/MinhasTarefas.tsx` — lê `?tab=` no mount (≤ 10 linhas)

## Não tocar

- Query do `useCorretorHomeData` (está correta — bug é só falta de invalidação)
- Tooltip "Desatualizados", badge Kanban, R4/R4.1/R4.5.1, schema `pipeline_tarefas`
- Helper `fetchLeadIdsSemTarefa` do R4 (refactor de unificação fica para Quality Sprint)

## Validação

- SQL antes/depois nos 3 corretores (teste=0, Cor1=40, Cor2=9) — já rodada
- Concluir uma tarefa do teste no preview → widget reflete em < 1s (não mais 60s)
- Visual desktop: 2 botões lado a lado; mobile (<640px): stack
- Click "Central de Tarefas" → `/tarefas` abre com aba "🟡 Desatualizados" pré-selecionada
- `SELECT * FROM ops_events WHERE fn='lead_sem_tarefa_action' ORDER BY created_at DESC LIMIT 5;`

Aguardando GO para Agent Mode.
