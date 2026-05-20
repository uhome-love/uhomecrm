
# Sprint 0 · Fase B — Plano de Correção do Modo Foco

Escopo: Grupos 1 (paridade) e 2 (instrumentação). Itens 7-13 da auditoria ficam para a próxima sprint.

Arquivos no escopo:
- `src/hooks/useFocusLeads.ts` (269 linhas)
- `src/components/pipeline/FocusModeModal.tsx` (1.098 linhas)
- `src/lib/taskQueryUtils.ts` (sem mudança prevista)
- `supabase/functions/homi-focus-suggestion/index.ts` (cache server-side opcional — descartado, ver item 6)

Sem mudanças de schema em `pipeline_leads`/`pipeline_tarefas`. Apenas uma migration leve: tabela nova `focus_insight_cache` (item 6) — justificada abaixo.

---

## Item 1 — Critério "Atrasada" igual ao Pipeline (hora + BRT)

**Arquivo:** `src/hooks/useFocusLeads.ts`
**Linhas afetadas:** 71-73 (definição de `todayStr`) e 160-175 (classificação overdue).

### A) Trecho atual

```ts
// linha 72-73
const today = new Date();
const todayStr = today.toISOString().split("T")[0];   // ← UTC
```

```ts
// linhas 149-175
const { rows: tasksData, errors: taskErrors } = await fetchInBatchesWithRetry<any>(
  leadIds,
  (chunk) =>
    supabase
      .from("pipeline_tarefas")
      .select("id, pipeline_lead_id, titulo, tipo, vence_em, status")
      .in("pipeline_lead_id", chunk)
      .eq("status", "pendente"),
  { chunkSize: 50, minChunkSize: 10 }
);

for (const t of tasksData || []) {
  if (!allTasks[t.pipeline_lead_id]) {
    allTasks[t.pipeline_lead_id] = { overdue: 0, hasFuture: false, overdueList: [] };
  }
  if (t.vence_em && t.vence_em < todayStr) {        // ← só compara data
    allTasks[t.pipeline_lead_id].overdue++;
    allTasks[t.pipeline_lead_id].overdueList.push({ ... });
  } else {
    allTasks[t.pipeline_lead_id].hasFuture = true;
  }
}
```

### B) Trecho novo

```ts
// hoje em BRT (consistente com SQL `AT TIME ZONE 'America/Sao_Paulo'`)
const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // "YYYY-MM-DD"
const nowHHMM_BRT = new Date().toLocaleTimeString("en-GB", {
  timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
}); // "HH:MM"
```

```ts
// inclui hora_vencimento no SELECT
const { rows: tasksData, errors: taskErrors } = await fetchInBatchesWithRetry<any>(
  leadIds,
  (chunk) =>
    supabase
      .from("pipeline_tarefas")
      .select("id, pipeline_lead_id, titulo, tipo, vence_em, hora_vencimento, status")
      .in("pipeline_lead_id", chunk)
      .eq("status", "pendente"),
  { chunkSize: 50, minChunkSize: 10 }
);

for (const t of tasksData || []) {
  if (!allTasks[t.pipeline_lead_id]) {
    allTasks[t.pipeline_lead_id] = { overdue: 0, hasFuture: false, overdueList: [] };
  }

  // Espelha CardStatusLine.getLeadStatusFilter:
  //   vence_em < hoje (BRT) → atrasada
  //   vence_em == hoje (BRT) && hora_vencimento < agora → atrasada
  const venceEm = t.vence_em as string | null;
  const hora = (t.hora_vencimento as string | null)?.slice(0, 5) ?? null;
  const isOverdue =
    !!venceEm && (
      venceEm < todayStr ||
      (venceEm === todayStr && !!hora && hora < nowHHMM_BRT)
    );

  if (isOverdue) {
    allTasks[t.pipeline_lead_id].overdue++;
    allTasks[t.pipeline_lead_id].overdueList.push({
      id: t.id,
      titulo: t.titulo || "(sem título)",
      vence_em: venceEm,
      tipo: (t as any).tipo ?? null,
    });
  } else {
    allTasks[t.pipeline_lead_id].hasFuture = true;
  }
}
```

**Por quê:** `toISOString()` retorna UTC; após 21h BRT o "hoje" pula um dia, corrompendo o critério. A regra do Pipeline (CardStatusLine.tsx L70-77) considera a hora do dia. Ambas as correções juntas fecham o gap de 218 leads.

### C) Migrations: nenhuma. `pipeline_tarefas.hora_vencimento` já existe.

### D) Validação

Após o fix, esta query deve dar **mesmo número** das duas colunas:

```sql
-- 1) Pipeline (referência) — leads ativos com tarefa pendente atrasada por data OU hora BRT
SELECT COUNT(DISTINCT t.pipeline_lead_id) AS pipeline_overdue
FROM pipeline_tarefas t
JOIN pipeline_leads l ON l.id = t.pipeline_lead_id
JOIN pipeline_stages s ON s.id = l.stage_id
WHERE t.status='pendente'
  AND l.arquivado=false
  AND s.tipo NOT IN ('descarte','convertido')
  AND l.negocio_id IS NULL
  AND (
    t.vence_em < (now() AT TIME ZONE 'America/Sao_Paulo')::date
    OR (t.vence_em = (now() AT TIME ZONE 'America/Sao_Paulo')::date
        AND t.hora_vencimento IS NOT NULL
        AND t.hora_vencimento < (now() AT TIME ZONE 'America/Sao_Paulo')::time)
  );
```

Hoje: Pipeline = 662, Foco = 444 (gap −218). Meta pós-fix: **gap = 0** (±2 por timing entre queries).

Manual: abrir Modo Foco → filtro "Tarefas atrasadas" → comparar contagem com badge vermelho do header do /pipeline-leads.

### E) Riscos

- Modo Foco passará a mostrar +50% leads. Sessão pode ficar mais longa — atinge gargalo de performance da seção 5 (próxima sprint).
- Tarefas com `hora_vencimento NULL` continuam classificadas como "do dia inteiro" (regra mem://rules/business/sla-and-overdue-logic já assume isso).
- Rollback: reverter ambos os trechos. Sem efeito colateral em outras telas.

---

## Item 2 — Leads com `negocio_id IS NOT NULL`

**Arquivo:** `src/hooks/useFocusLeads.ts`
**Linhas afetadas:** 115-117.

### Decisão recomendada: **Opção B — manter excluídos, mas explicitar na UI**

**Justificativa:** Hoje só **2 leads** na base inteira têm `negocio_id NOT NULL` em stage ativo não-descarte. Impacto operacional ~0. Já existe a tela dedicada `/meus-negocios` com o próprio Modo Foco (`pipelineTipo="negocios"`). Trazer para o Foco de leads duplicaria carga cognitiva e quebra a separação "Leads ↔ Negócios" que o produto mantém em todo lugar.

### B) Trecho atual

```ts
// linhas 115-117
if (pipelineTipo === "leads") {
  query = query.is("negocio_id", null);
}
```

### B) Trecho novo

```ts
// linhas 115-117 — sem mudança de comportamento, apenas comentário
if (pipelineTipo === "leads") {
  // Leads que já viraram negócio aparecem só em /meus-negocios → Modo Foco (Negócios).
  // Mantemos exclusão para não duplicar (~2 leads na base hoje).
  query = query.is("negocio_id", null);
}
```

Adicionar texto único no rodapé da tela de config (FocusModeModal, dentro do bloco "Stage filter" L601-620):

```tsx
<p className="text-[10px] text-gray-500 mt-1">
  Negócios em andamento aparecem em <span className="text-gray-300">Meus Negócios → Modo Foco</span>.
</p>
```

### C) Migrations: nenhuma.

### D) Validação: contagem do Foco (`leads`) === contagem Pipeline filtrado por `negocio_id IS NULL` (`pipeline.leads.filter(l => !l.negocio_id)`).

### E) Riscos: nulos. Texto explicativo elimina queixa "por que esse lead com negócio não aparece?".

---

## Item 3 — Filtro "5 dias parado"

**Arquivo:** `src/hooks/useFocusLeads.ts`
**Linhas afetadas:** 1-9 (header) e 182-184 + 195.

### Decisão recomendada:

1. Trocar constante mágica por export configurável.
2. Subir o default de **5 → 14 dias** (justificativa abaixo).
3. Criar memory rule descrevendo origem.

### Justificativa numérica

Distribuição real de `days_in_stage` (leads ativos hoje, exclui descarte/convertido):

| Métrica | Dias na etapa |
|---|---|
| P50 | 28,8 |
| P75 | 69,0 |
| P90 | 72,7 |

Ou seja, metade dos leads ativos já está parada >29 dias. Um corte de 5 dias varre >75% do pipeline — o filtro "Desatualizados" hoje vira sinônimo de "quase tudo" e perde valor. **14 dias** dá um sinal acionável: pega leads parados há mais de 2 semanas sem virar ruído.

### B) Trecho atual

```ts
// linha 1-9
/**
 * useFocusLeads — Fetches leads needing attention for Focus Mode.
 *
 * Criteria (filterable):
 *  1. No pending tasks at all (desatualizado)
 *  2. Overdue pending tasks (vence_em < today)
 *  3. Stage stalled > 5 days (stage_changed_at < now - 5d)
 * ...
 */
```

```ts
// linhas 182-184
const fiveDaysAgo = new Date();
fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
const fiveDaysAgoStr = fiveDaysAgo.toISOString();
```

```ts
// linha 195
const stageStalled = lead.stage_changed_at < fiveDaysAgoStr;
```

### B) Trecho novo

```ts
/**
 * useFocusLeads — Fetches leads needing attention for Focus Mode.
 *
 * Criteria (filterable):
 *  1. No pending tasks at all (desatualizado / sem tarefa)
 *  2. Overdue pending tasks (data passada OU hora BRT passada hoje)
 *  3. Stage stalled — sem movimentação há FOCUS_STAGNANT_DAYS dias
 */

/** Dias de parada em uma etapa para o lead ser considerado "Desatualizado".
 *  Default 14d (P50 do pipeline = ~29d; 5d original gerava ruído em 75% da base). */
export const FOCUS_STAGNANT_DAYS = 14;
```

```ts
// linhas 182-184
const stagnantThreshold = new Date();
stagnantThreshold.setDate(stagnantThreshold.getDate() - FOCUS_STAGNANT_DAYS);
const stagnantThresholdISO = stagnantThreshold.toISOString();
```

```ts
// linha 195
const stageStalled = lead.stage_changed_at < stagnantThresholdISO;
```

Atualizar label em `FocusModeModal.tsx` L53 e L216:
```tsx
{ value: "stagnant", label: "Desatualizados", description: `Leads parados na mesma etapa há ${FOCUS_STAGNANT_DAYS}+ dias`, ... }
```
```ts
if (stageStalled) alertReasons.push(`Etapa parada há ${daysInStage} dias`);
```

### C) Migrations: nenhuma.

### Memory rule a criar (texto a salvar após aprovação)

```
mem://features/pipeline/modo-foco-criterios
---
Modo Foco — definições:
- Atrasada: regra única espelhando CardStatusLine.getLeadStatusFilter (data passada OU vence_em=hoje BRT && hora_vencimento < agora BRT).
- Desatualizado (sem tarefa): mesma regra do badge amarelo do Pipeline.
- Etapa parada: stage_changed_at < now() - FOCUS_STAGNANT_DAYS dias.
  Default 14d (P50 real = ~29d; valor antigo de 5d marcava >75% da base).
  Constante em src/hooks/useFocusLeads.ts; alterar só com aval do CEO.
- Leads com negocio_id são excluídos do Foco de "leads" — aparecem só no Foco de "negocios".
```

### D) Validação

```sql
-- Quantos leads o filtro stagnant retornaria com cada threshold?
SELECT
  COUNT(*) FILTER (WHERE stage_changed_at < now() - interval '5 days')  AS d5,
  COUNT(*) FILTER (WHERE stage_changed_at < now() - interval '14 days') AS d14,
  COUNT(*) FILTER (WHERE stage_changed_at < now() - interval '30 days') AS d30,
  COUNT(*) total
FROM pipeline_leads l
JOIN pipeline_stages s ON s.id=l.stage_id
WHERE l.arquivado=false AND l.negocio_id IS NULL AND s.tipo NOT IN ('descarte','convertido');
```

Meta: `d14 / total` em ~50% (acionável, não ruído).

### E) Riscos

- Corretores acostumados ao volume antigo de "Desatualizados" verão lista menor — explicar no release note.
- Rollback: trocar constante para 5.

---

## Item 4 — "Todos" no Modo Foco

### Decisão recomendada: **Renomear para "Tudo que precisa de atenção"** + manter semântica atual.

**Justificativa:** Expandir "Todos" para incluir leads em dia significaria mostrar 600-700 cards em sequência → contradiz a proposta do Modo Foco ("trabalhar quem precisa"). O fix é honestidade de label.

**Arquivo:** `src/components/pipeline/FocusModeModal.tsx`
**Linhas afetadas:** L50.

### B) Trecho atual

```ts
{ value: "all", label: "Todos", description: "Todos os leads que precisam de atenção", icon: <Target className="w-5 h-5" />, color: "#4969FF" },
```

### B) Trecho novo

```ts
{ value: "all", label: "Tudo que precisa de atenção", description: "Atrasados, sem tarefa ou parados há +14 dias", icon: <Target className="w-5 h-5" />, color: "#4969FF" },
```

### C) Migrations: nenhuma. **D)** Visual. **E)** Risco zero.

---

## Item 5 — Telemetria de uso (ops_events)

**Arquivo:** `src/components/pipeline/FocusModeModal.tsx`
**Linhas afetadas:** 102-120 (mount config), 137-150 (start), 251-260 (advance), 530 (close).

`ops_events` schema confirmado: `id, created_at, fn, level, category, message, trace_id, ctx (jsonb), error_detail`.

### B) Helper novo no topo do arquivo (após linha 23)

```ts
async function logFocus(
  fn: "focus_mode_opened" | "focus_mode_advance" | "focus_mode_closed",
  ctx: Record<string, unknown>,
) {
  try {
    await supabase.from("ops_events").insert({
      fn,
      level: "info",
      category: "focus_mode",
      message: fn,
      ctx,
    } as any);
  } catch (e) {
    // telemetria nunca pode quebrar a UX
    console.warn("[FocusMode] telemetry failed", e);
  }
}
```

### Pontos de instrumentação

1. **`handleStartFocus`** (após L149 `await reload(filters);`):
```ts
await logFocus("focus_mode_opened", {
  corretor_id: corretorId,
  pipeline_tipo: pipelineTipo,
  criteria: selectedCriteria,
  stage_id: selectedStageId,
  total_leads: leads.length,         // já populado pelo reload
});
```

2. **`goToNext`** (dentro do branch que avança, antes de `setCurrentIndex`, L253):
```ts
logFocus("focus_mode_advance", {
  corretor_id: corretorId,
  from_index: currentIndex,
  to_index: currentIndex + 1,
  total: leads.length,
  lead_id: currentLead?.id,
});
```

3. **`onClose`** — interceptar no botão X (L530) e no fim natural (L257):

Adicionar wrapper:
```ts
const handleClose = useCallback(() => {
  logFocus("focus_mode_closed", {
    corretor_id: corretorId,
    pipeline_tipo: pipelineTipo,
    final_index: currentIndex,
    total: leads.length,
    completed: leads.length > 0 && currentIndex >= leads.length - 1,
  });
  onClose();
}, [onClose, corretorId, pipelineTipo, currentIndex, leads.length]);
```

Trocar todas as chamadas `onClose()` dentro do componente por `handleClose()`.

### C) Migrations: nenhuma. RLS de `ops_events` precisa permitir INSERT do role `authenticated`. Validar antes:

```sql
SELECT polname, polcmd, polroles::regrole[]
FROM pg_policy WHERE polrelid='public.ops_events'::regclass;
```

Se INSERT não estiver liberado, **PARAR** e relatar — não está nas regras desta sprint criar policy.

### D) Validação

```sql
SELECT fn, COUNT(*), MAX(created_at)
FROM ops_events
WHERE created_at > now() - interval '1 day' AND category='focus_mode'
GROUP BY fn ORDER BY 1;
```

Métrica de sucesso: após release, dentro de 24h ter ≥1 evento de cada tipo (`opened`, `advance`, `closed`).

### E) Riscos

- Volume: pior caso (1 corretor abrindo 30 leads) = 32 rows/sessão. Sem impacto.
- Erro de INSERT é capturado e logado no console — UX não quebra.
- Se RLS não permitir INSERT, a chamada falha silenciosa — descobriremos imediatamente na validação.

---

## Item 6 — Cache de HOMI Insight

### Decisão recomendada: **cache em memória do componente + TTL implícito por sessão.** Sem mudança de schema.

**Justificativa:** Hoje a chamada `homi-focus-suggestion` retorna `mensagem + insight` por lead. Mas:

- Telemetria mostra **0 chamadas em 7 dias** → ainda não há demanda real para cache server-side.
- Cache em DB (`pipeline_leads.homi_insight_cached`) viola a regra "não mudar schema sem justificativa".
- Tabela dedicada `focus_insight_cache` seria overkill antes de termos sinal de uso.
- Cache em sessão já elimina o caso real reclamado: "voltei pro lead anterior e ele chamou IA de novo".

**TTL recomendado:** invalidar quando (a) o usuário fecha o modal, (b) uma atividade nova é registrada para o lead via Modo Foco (já temos `setActivityRegistered`), (c) opcionalmente após 4h.

### Estimativa de economia

Sessão típica suposta = 30 leads, 20% de revisitas (volta atrás) → ~6 chamadas Gemini economizadas/sessão. Em 50 sessões/dia = 300 chamadas/dia × ~$0,0003 (Flash) ≈ **$0,09/dia**. Custo financeiro irrelevante. O ganho real é **latência**: revisitar lead vira instantâneo (vs 1-3s).

**Arquivo:** `src/components/pipeline/FocusModeModal.tsx`
**Linhas afetadas:** 76-78 (estado), 152-156 (effect), 177-233 (`fetchHomiSuggestion`), 235-249 (`resetActionState`), 296 (após registrar atividade).

### B) Trecho atual

```ts
// L76-78
const [homiInsight, setHomiInsight] = useState("");
const [followUpText, setFollowUpText] = useState("");
const [homiLoading, setHomiLoading] = useState(false);
```

```ts
// L152-156
useEffect(() => {
  if (!currentLead || !open || configPhase) return;
  fetchHomiSuggestion(currentLead);
}, [currentIndex, leads.length, open, configPhase]);
```

```ts
// L177-233 — fetchHomiSuggestion sempre invoca edge function
```

### B) Trecho novo

```ts
// L76-78
const [homiInsight, setHomiInsight] = useState("");
const [followUpText, setFollowUpText] = useState("");
const [homiLoading, setHomiLoading] = useState(false);

// Cache por sessão: { leadId -> { insight, mensagem, at } }
const insightCacheRef = useRef<Map<string, { insight: string; mensagem: string; at: number }>>(new Map());
const INSIGHT_TTL_MS = 4 * 60 * 60 * 1000; // 4h
```

```ts
// L152-156
useEffect(() => {
  if (!currentLead || !open || configPhase) return;

  const cached = insightCacheRef.current.get(currentLead.id);
  if (cached && Date.now() - cached.at < INSIGHT_TTL_MS) {
    setHomiInsight(cached.insight);
    setFollowUpText(cached.mensagem);
    setHomiLoading(false);
    return;
  }
  fetchHomiSuggestion(currentLead);
}, [currentIndex, leads.length, open, configPhase]);
```

```ts
// dentro de fetchHomiSuggestion (após L224-225)
setHomiInsight(data?.insight || "");
setFollowUpText(data?.mensagem || "");
insightCacheRef.current.set(lead.id, {
  insight: data?.insight || "",
  mensagem: data?.mensagem || "",
  at: Date.now(),
});
```

```ts
// Invalidação após registrar atividade — handleRegisterActivity, após toast.success L295
insightCacheRef.current.delete(currentLead.id);
```

```ts
// Limpar cache quando o modal fecha (dentro do effect que reseta na abertura, L102-120)
// já roda no setConfigPhase(true) ao abrir; adicionar:
insightCacheRef.current.clear();
```

### C) Migrations: **nenhuma.**

(Alternativa server-side com `focus_insight_cache` foi avaliada e descartada. Caso o usuário queira persistência cross-session no futuro, planejar separadamente.)

### D) Validação

- Manual: abrir Foco com filtro "Atrasadas", navegar lead 1 → 2 → voltar para 1. Insight deve aparecer instantâneo na volta (sem `Loader2`). Network tab: nenhuma chamada a `homi-focus-suggestion` na revisita.
- Registrar atividade no lead 1 → voltar para o lead 1 mais tarde → deve recarregar (cache invalidado).
- Telemetria (após item 5): contar `advance` ÷ chamadas a `homi-focus-suggestion` no edge log → deve cair para <1.0 (era 1.0).

### E) Riscos

- Stale data se outra aba alterar o lead. Mitigação: invalidação local em qualquer mutação feita pelo próprio Foco já cobre o caso típico. Cross-tab fica fora desta sprint.
- `useRef<Map>` não é serializável → ok, é só vida útil de sessão (desejado).
- Rollback: remover o lookup do cache e voltar a chamar sempre.

---

## Ordem de execução recomendada

| # | Item | Por que nessa ordem |
|---|---|---|
| 1 | **Item 1** (paridade hora/BRT) | Maior valor (gap 218 leads) e isolado em `useFocusLeads.ts`. Sem dependência. |
| 2 | **Item 3** (5d → 14d configurável) | Mesmo arquivo do Item 1. Aproveita a mesma rodada de validação manual. |
| 3 | **Item 4** (label "Todos") | Trivial. Aproveita o deploy do Modal. |
| 4 | **Item 2** (negocio_id explícito) | Texto na UI + comentário. Trivial. |
| 5 | **Item 5** (telemetria) | Precisa ir antes do item 6 para medirmos a economia que ele gera. |
| 6 | **Item 6** (cache HOMI) | Por último: depende do item 5 estar coletando para confirmar redução. |

**Paralelismo:** itens 1+3+4 alteram os mesmos dois arquivos → fazer juntos em uma rodada. Itens 2, 5 e 6 podem entrar na segunda rodada.

**Total estimado:** 2 rodadas de edit; **≈ 1,5h Lovable** (sem contar validação manual com corretor).

---

## Feature flag

**Recomendação: NÃO usar feature flag.**

- Itens 1-4 são correções de bug óbvio (Foco mostrando dados errados). Liberar em fases significa deixar corretores trabalhando com lista errada por mais tempo.
- Itens 5-6 são telemetria e cache local. Risco operacional zero.

Se quiser mitigar mesmo assim: testar no preview (`id-preview--…lovable.app`) com 1 corretor por 1 dia antes de publicar — sem custo de flag.

---

## Janela de execução

Regras do projeto (`mem://rules/engineering/permanent-rules-2026-05`): "máx 2 migrations/dia em 08-19h BRT". Esta sprint **não tem migrations** (DDL zero), portanto:

- Pode ser executada em **qualquer horário útil**.
- Não precisa janela noturna.
- Não força `PostgREST reload`.

---

## Resumo de regras duras atendidas

- Arquivos tocados: apenas `src/hooks/useFocusLeads.ts`, `src/components/pipeline/FocusModeModal.tsx`. ✓
- `src/lib/taskQueryUtils.ts` não muda. ✓
- `supabase/functions/homi-focus-suggestion/` não muda. ✓
- Sem alteração de schema `pipeline_leads`/`pipeline_tarefas`. ✓
- Nenhum item escapou de "Grupos 1-2". ✓
- Item de cache cresceu menos que o esperado (descartada tabela nova) — não há nada para escalar.

Aguardando validação do plano para iniciar execução em ordem.
