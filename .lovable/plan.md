# Lote 4c — Contrato de estado do dashboard CEO (parar o "erro vira zero") + limpeza do código morto

Frontend apenas. Sem migration, sem mudança de dados, sem publish.

---

## (a) Verificação de código morto — resultado da auditoria

Grep em todo `src/` por `useCeoData`, `CeoOverview`, `CeoRankings`, `CeoAlerts`, `CeoTeamComparison`:

| Arquivo | Quem importa |
|---|---|
| `src/components/ceo/CeoOverview.tsx` | **ninguém** (só se importa a si mesmo via `useCeoData`) |
| `src/components/ceo/CeoRankings.tsx` | **ninguém** |
| `src/components/ceo/CeoAlerts.tsx` | **ninguém** |
| `src/components/ceo/CeoTeamComparison.tsx` | **ninguém** |
| `src/hooks/useCeoData.ts` | importado por 7 arquivos: os 4 acima **+** `src/components/ranking/RankingGeralTab.tsx`, `RankingVGVTab.tsx`, `RankingEficienciaTab.tsx` |

Segundo nível: os 3 `Ranking*Tab.tsx` **também não são importados por nenhuma rota/tela** — o `/performance` e o `RankingEquipe.tsx` usam apenas `components/ranking/v2/*`.

Conclusão:
- Os **4 componentes CEO são órfãos confirmados** → removíveis.
- `useCeoData.ts` **não é órfão direto** (3 imports vivos no arquivo-sistema), mas seus únicos consumidores restantes são eles próprios órfãos. Removê-lo exige remover também os 3 tabs de ranking legados — proponho isso como passo opcional, com aprovação explícita (é um cluster maior, fora do escopo "CEO").

## (b) Hook vivo `src/hooks/useCeoDashboard.ts`

9 `useQuery` hoje, **nenhum** expõe erro; todos caem em default (`EMPTY_KPIS`, `[]`, `null`), então falha = zero.

| Query (queryKey) | Alimenta | Classificação |
|---|---|---|
| `ceo-kpis` | KPIs principais (ligações, visitas, VGV) | **ESSENCIAL** |
| `ceo-pipeline` | funil, campanhas, alertas, origens, leads por corretor/empr. | **ESSENCIAL** |
| `ceo-negocios` | funil de negócios, VGV em risco, top corretores, vendas | **ESSENCIAL** |
| `ceo-teams` | performance por equipe, ranking corretores | OPCIONAL (parcial) |
| `ceo-extra-kpis` | visitas criadas, agenda, presentes hoje, metas do dia | OPCIONAL (parcial) |
| `ceo-visitas-emp` | visitas por empreendimento | OPCIONAL (parcial) |
| `ceo-kpis-prev` | apenas deltas % | OPCIONAL (some o delta) |
| `ceo-vgv-mes` | VGV do mês | OPCIONAL (parcial) |
| `ceo-profile` / `ceo-roleta` | saudação / fila de credenciamento | OPCIONAL (parcial) |

### Diff conceitual do retorno (100% aditivo)

```ts
// erros individuais
const { data: kpis = EMPTY_KPIS, error: kpisError, ... } = useQuery(...)
// idem para pipeline, negocios, teams, extraKpis, visitasEmp, vgvMes, roleta

return {
  ...tudo que já existe (inalterado),

  // NOVO — contrato de estado
  error: kpisError ?? pipelineError ?? negociosError ?? null, // erro DURO
  isError: Boolean(kpisError || pipelineError || negociosError),
  partial: Boolean(teamsError || extraError || visitasEmpError || vgvMesError || prevError || roletaError),
  partialSources: string[],   // ex.: ["equipes", "visitas por empreendimento"]
  errors: { kpis, pipeline, negocios, teams, extra, visitasEmp, vgvMes, prev, roleta },
};
```

Nada é removido nem renomeado → consumidor único (`CeoDashboard.tsx`) não quebra.

## (c) Telas vivas do `/ceo` — onde aplicar `StateWrapper`

`/ceo` monta `src/pages/CeoDashboard.tsx` (1076 linhas, aba "dashboard" + aba "empresa" com `TabEmpresa`).

1. **Envelope da aba Dashboard** (linha ~444): `StateWrapper` com
   `error={error}`, `loading={loading && !profile}`, `skeleton={<CeoDashboardSkeleton />}`,
   `stale={partial}` + `staleMessage` listando as fontes que falharam, `onRetry={reload}`.
   Substitui o early-return `if (loading && !profile) return <CeoDashboardSkeleton />`.
2. **Card "Alertas"** (linha ~1024) — caso crítico de mascaramento: hoje `alertas.length === 0` renderiza "nenhum alerta" mesmo quando a query falhou. Envolver com `StateWrapper` usando `error={errors.pipeline}`, `empty={alertas.length===0}`, `emptyTitle="Nenhum alerta"`, `onRetry`.
3. **"Performance por Equipe"** (~871) e **"Top Corretores — Oferta Ativa"** (~923) — `error={errors.teams}` / `empty`, `onRetry`.
4. **"Funil do Pipeline"** (~625) e **"Funil de Negócios"** (~734) — `error={errors.pipeline}` / `errors.negocios`, `empty` quando todas as etapas são 0.
5. **Fila de credenciamento (roleta)** — `error={errors.roleta}`, `empty`, `onRetry={reloadRoleta}`.
6. **`TabEmpresa.tsx`** — envolver o corpo com um `StateWrapper` ligado ao erro da sua própria query (o componente busca dados próprios), com `onRetry` = refetch local.

Regra: um `StateWrapper` por seção, nunca aninhado; o envelope da página só dispara `ErrorState` em erro ESSENCIAL.

## (d) Remoção do código morto

Deletar (órfãos confirmados):
- `src/components/ceo/CeoOverview.tsx`
- `src/components/ceo/CeoRankings.tsx`
- `src/components/ceo/CeoAlerts.tsx`
- `src/components/ceo/CeoTeamComparison.tsx`

**NÃO** deletar agora: `src/hooks/useCeoData.ts` — ainda importado por `RankingGeralTab.tsx`, `RankingVGVTab.tsx`, `RankingEficienciaTab.tsx`. Opcional, se você autorizar no mesmo lote: deletar esses 3 tabs (também sem nenhuma rota montando-os) **e então** `useCeoData.ts`. Sem essa autorização, o hook fica.

## (e) Arquivos tocados, riscos e validação

Tocados: `src/hooks/useCeoDashboard.ts`, `src/pages/CeoDashboard.tsx`, `src/components/ceo/TabEmpresa.tsx`, + 4 deleções.

Riscos:
- Retorno do hook muda, mas só de forma aditiva e há **um único consumidor** → risco baixo.
- Erro que antes passava despercebido agora vira `ErrorState` visível — é o objetivo, mas pode "aparecer" problema pré-existente de RLS/consulta.
- `partial` não pode virar banner permanente: só liga com erro real, não com `isFetching`.

Validação no preview: abrir `/ceo`, conferir números idênticos aos de hoje; trocar período (dia/semana/mês) e ver skeleton em vez de zeros; simular falha (DevTools offline) e confirmar ErrorState + botão "Tentar novamente" refazendo as queries; conferir card de Alertas mostrando erro em vez de "nenhum alerta"; abrir aba Empresa; conferir `/performance` e `/ranking-equipe` intactos após as deleções.
