## Diagnóstico (confirmado no banco)

O placar do dia mostrou **25 marcadas / 22 realizadas** para hoje (27/07/2026), quando só existiam **3 visitas reais**.

Consulta em `visitas` revelou:
- **22 registros** criados hoje às `17:03:09.271196+00`, todos com:
  - `data_visita = 2026-07-27` (hoje)
  - `hora_visita = 10:00:00`
  - `status = 'realizada'`
  - `origem = 'backfill_pos_visita'`
  - `observacoes` começando com "Backfill 27/07/2026: registro retroativo criado para consistência…"

Esses 22 vieram do **backfill de conciliação de Pós-Visita** que rodei na etapa anterior (leads que estavam em Pós-Visita via `flag_status.status_visita='realizada'` mas sem registro na agenda). O backfill usou `CURRENT_DATE` como `data_visita`, o que era errado — deveria ter usado a data real em que o lead entrou em Pós-Visita.

Efeito colateral: **todo placar diário de visitas** (CEO, Gerente, Ranking) que filtra por `data_visita = hoje` está inflado por esses 22.

## Correção proposta

### 1. Migration — reverter `data_visita` dos 22 backfills para a data real
Para cada visita com `origem='backfill_pos_visita'` criada hoje:
- Buscar o `stage_changed_at` do respectivo `pipeline_lead_id` (quando ele entrou em Pós-Visita).
- Se existir e for anterior a hoje: `UPDATE visitas SET data_visita = stage_changed_at::date` (mantendo `hora_visita`).
- Fallback: se `stage_changed_at` for de hoje/futuro ou nulo, usar `updated_at::date - 1 dia` do lead (ainda melhor que hoje).
- **Não deletar** os registros — a Conferência de Visitas do mês depende deles e a observação de backfill fica preservada como auditoria.

### 2. Blindar cálculos diários contra backfills futuros
Adicionar filtro `origem <> 'backfill_pos_visita'` (ou padrão excluir backfills) nos KPIs de "hoje" para não contaminar contadores mesmo se um novo backfill ocorrer com data errada. Locais confirmados:
- `src/hooks/useCeoDashboard.ts` (fonte dos `kpis.visitasMarcadas`, `visitasRealizadas`, `noShows`, `totalVisitasCriadas` do card "Agenda de Visitas").
- Verificar e ajustar (se houver o mesmo padrão) em: `src/hooks/useCorretorKpisConquistas.ts`, `src/components/ranking/v2/RankingVisitas.tsx`, `src/components/checkpoint/CheckpointVisaoGeralTab.tsx`, `src/hooks/useRelatorioExecutivo.ts`.

Regra: os placares de **hoje/dia** excluem backfills. Os relatórios de **mês** (Conferência de Visitas, PDN mensal) mantêm os backfills, pois representam visitas reais que aconteceram em algum momento.

### 3. Validação ponta a ponta após o fix
- Contar novamente `visitas` de hoje: deve retornar **3** (as reais).
- Abrir `/ceo` → card "Agenda de Visitas" deve mostrar números de hoje reais (~3).
- Abrir `/pdn` → aba **Conferência de Visitas** (mês) deve continuar mostrando ~128 visitas do mês, agora com os 22 distribuídos nas datas reais.
- Abrir 2-3 leads do bucket "Em Pós-Visita" e confirmar que a visita associada mostra a data reconstituída (não hoje).
- Sanidade: `/agenda-visitas` do gestor não deve exibir todos os 22 concentrados no dia de hoje.

### 4. Regra permanente
Registrar em memória: **backfill de visitas NUNCA pode usar `CURRENT_DATE` como `data_visita`**. Sempre reconstituir da fonte (stage_changed_at, primeira ocorrência da flag, etc.). Origem `backfill_*` fica excluída de todo cálculo de "hoje".

## Detalhes técnicos

**SQL do fix (a rodar via migration):**
```sql
UPDATE public.visitas v
SET data_visita = COALESCE(
      NULLIF(pl.stage_changed_at::date, CURRENT_DATE),
      (pl.updated_at::date - INTERVAL '1 day')::date,
      (CURRENT_DATE - INTERVAL '1 day')
    )
FROM public.pipeline_leads pl
WHERE v.pipeline_lead_id = pl.id
  AND v.origem = 'backfill_pos_visita'
  AND v.created_at::date = DATE '2026-07-27'
  AND v.data_visita = DATE '2026-07-27';
```

**Filtro nos hooks (padrão):**
```ts
.eq(...).neq("origem", "backfill_pos_visita")
```
ou (preferido) `.not("origem", "like", "backfill_%")` para pegar qualquer backfill futuro.

## Escopo desta correção
- Sim: reverter as 22 datas, blindar KPIs do dia, validar placares.
- Não: mexer nos triggers `trg_visita_realizada_move_pos_visita` / `trg_visita_sync_flag_status` (funcionam certo — o problema foi o backfill que rodou uma vez).
- Não: deletar os registros de backfill (perderia rastreabilidade dos leads em Pós-Visita).
