## Root cause confirmado

**Bug 1 — Central de Tarefas não muda de aba**
`MinhasTarefas.tsx` (linhas 106–114) **lê `?tab=` corretamente no mount** via `useState(initialTab)`. Mas o app usa `TabProvider` (Chrome-style tabs, `src/contexts/TabContext.tsx` em `App.tsx`), então quando o usuário já tem `/minhas-tarefas` aberta e clica num KPI do Dashboard com `?tab=hoje`, o componente **não remonta** — `useState` só roda na primeira montagem e a URL muda mas o state fica em "todas". Mesma armadilha para qualquer tab persistente.

**Bug 2 — Agenda não filtra "Realizadas"**
Dois problemas combinados:
1. `ConquistasKpis.tsx` linha ~31 navega para `/agenda-visitas` **sem query param**.
2. `AgendaVisitas.tsx` (linha 332) lê `searchParams.get("status")` no mount, mas tem **a mesma falha** do Bug 1 (sem useEffect de sync com URL).

O nome do param correto na Agenda é **`?status=realizadas`** (plural, confirmado na linha 389 do filtro `kpiFilter === "realizadas"`).

## Decisões abertas — respostas

| Pergunta | Resposta |
|---|---|
| Bug 2 root cause | **Ambos**: ConquistasKpis não passa param + AgendaVisitas não re-sincroniza |
| Nome do param na Agenda | **`?status=realizadas`** (já existente, plural) |
| Sincronizar URL ao trocar aba manualmente | **Não** neste fix (escopo cirúrgico). Já existe `setSearchParams` parcial na Agenda. Fica pra ajuste futuro. |

## Fix proposto

### 1. `src/pages/MinhasTarefas.tsx`
Adicionar `useEffect` logo após os `useState` (após linha 114) que escuta mudanças em `searchParams` e re-aplica:

```ts
useEffect(() => {
  const t = searchParams.get("tab");
  const valid: TabFilter[] = ["todas","hoje","amanha","semana","atrasadas","desatualizados","concluidas"];
  if (t && (valid as string[]).includes(t) && t !== activeTab) {
    setActiveTab(t as TabFilter);
    if (t === "desatualizados") setCategoria("leads");
  }
}, [searchParams]);
```

Não tocar em mais nada do arquivo. `initialTab` continua funcionando para o caso de mount fresh.

### 2. `src/pages/AgendaVisitas.tsx`
Adicionar `useEffect` análogo após os `useState` (~linha 345):

```ts
useEffect(() => {
  const s = searchParams.get("status");
  if (s !== kpiFilter) setKpiFilter(s);
}, [searchParams]);
```

Não mexer no resto. A escrita de URL via `setSearchParams` já existe e continua.

### 3. `src/components/corretor/ConquistasKpis.tsx`
Trocar a navegação do card "Visitas realizadas":
- antes: `navigate("/agenda-visitas")`
- depois: `navigate("/agenda-visitas?status=realizadas")`

E enriquecer a telemetria com `destination: 'agenda', status: 'realizadas'`. Card "Vendas" continua igual (página dedicada).

## Arquivos tocados
- `src/pages/MinhasTarefas.tsx` — +1 useEffect
- `src/pages/AgendaVisitas.tsx` — +1 useEffect
- `src/components/corretor/ConquistasKpis.tsx` — 1 string + telemetria

## NÃO tocar
- `CarteiraKpis.tsx` (já passa `?tab=` correto e agora funciona graças ao useEffect de MinhasTarefas)
- Hooks, layout do Dashboard, Sprint 1, FocusModeModal

## Critérios de aceite
- [ ] KPI "Para hoje" → Central abre na aba **Hoje** mesmo se a página já estava aberta em outra aba
- [ ] KPI "Atrasados" → aba **Atrasadas** ativa
- [ ] KPI "Sem tarefa" → aba **Desatualizados** ativa (categoria força "leads")
- [ ] KPI "Visitas realizadas" → Agenda com filtro **Realizadas** ativo (URL = `?status=realizadas`)
- [ ] Trocar aba manualmente na Central continua funcionando (sem regressão)
- [ ] Filtros KPI internos da Agenda continuam funcionando
- [ ] Build limpo, sem warnings novos

Aguardando GO para Agent.