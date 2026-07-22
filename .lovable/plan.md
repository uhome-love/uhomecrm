# Fase 4 — Integração Bidirecional PDN ↔ Lead

Objetivo: fazer o PDN "conversar" com o pipeline em tempo real, sem duplicidade. Hoje o PDN já **lê** do pipeline (`negocios`, `pipeline_leads`, `visitas`) e **grava** overlay em `pdn_entries` + publica observação no lead via idempotência SHA-1. Falta o caminho de volta: eventos do lead aparecerem no PDN e mudanças de status do PDN refletirem no lead sem depender de "Publicar".

## O que muda

### 1. Timeline PDN dentro do Drawer do Lead
No `PdnLeadDrawer` (aba "Contexto"), mostrar as últimas 5 atividades reais do lead vindas de `pipeline_atividades` + `visita_eventos` (visita marcada / realizada / no-show / feedback) em ordem cronológica. Somente leitura — link "Ver tudo no lead" abre o drawer completo do pipeline.

### 2. Badge "atualizado hoje" no card/linha do PDN
Card do Kanban e linha da planilha ganham um pulso verde discreto quando o lead teve:
- mudança de `stage_id` nas últimas 24h, ou
- nova entrada em `visita_eventos` nas últimas 24h, ou
- observação publicada pelo gestor nas últimas 24h.

Fonte: `pipeline_leads.updated_at` + `visita_eventos.created_at` + `pdn_entries.observacao_updated_at` (já existe).

### 3. "Marcar em risco" agora escreve tag no lead
Hoje `⚠️ Marcar queda` só grava em `pdn_entries.em_risco=true`. Passa a também:
- inserir uma `pipeline_atividades` com `tipo='pdn_risco'` e o motivo,
- setar `pipeline_leads.flag_status='em_risco_pdn'` (flag reversível).

Ao desmarcar risco no PDN, limpar a flag e registrar a reversão.

### 4. "Avisar corretor" real
Substituir o toast placeholder por um insert em `notifications` (tipo `pdn_aviso`) para o `corretor_id` do lead, com deep-link `/pipeline/leads?leadId={id}`. Batch action idem para múltiplos.

### 5. Refetch automático
Assinar `postgres_changes` de `pipeline_leads` (filtrado por `id IN (...)` da tela) e `visita_eventos` para invalidar a query do PDN. Debounce 800ms para não flushar em cada tecla.

## Arquivos afetados

- `src/components/pdn/PdnLeadDrawer.tsx` — nova seção "Atividade recente" (aba Contexto).
- `src/hooks/pdn/usePdnLeadTimeline.ts` — **novo**: consulta `pipeline_atividades` + `visita_eventos` limit 5.
- `src/components/pdn/kanban/PdnCard.tsx` e `src/pages/PdnGestor.tsx` (linha da planilha) — badge "🟢 hoje".
- `src/lib/pdnActions.ts` — `marcarRisco()` e `avisarCorretor()` atualizados (novos helpers + escrita em `pipeline_atividades` / `notifications`).
- `src/hooks/pdn/usePdnLive.ts` — **novo**: canal realtime + invalidate.
- `src/components/pdn/BulkActionBar.tsx` — usar os helpers novos.

## Backend

Sem novas tabelas. Migração mínima:

```sql
-- índice para acelerar timeline por lead
create index if not exists idx_pipeline_atividades_lead_created
  on public.pipeline_atividades (lead_id, created_at desc);

create index if not exists idx_visita_eventos_lead_created
  on public.visita_eventos (lead_id, created_at desc);
```

Sem alteração de RLS (leituras já permitidas ao gestor via políticas atuais).

## Fora de escopo (fica pra Fase 5/6)

- Toolbar unificada entre Planilha e Kanban.
- Modularização do `PdnGestor.tsx` (>800 linhas).
- Permissões finas (diretoria vs gerente).

## Validação ponta-a-ponta

1. Abrir PDN → Kanban.
2. Clicar num card recente → drawer mostra "Atividade recente" com 3-5 linhas reais.
3. Selecionar 2 cards → "⚠️ Marcar queda" → conferir em `pipeline_atividades` (tipo `pdn_risco`) e `pipeline_leads.flag_status`.
4. Selecionar 2 cards → "📣 Avisar corretor" → conferir `notifications` inseridas.
5. Trocar stage do lead no pipeline em outra aba → PDN recarrega sozinho e mostra badge "🟢 hoje".

Confirma que é isso que você quer? Se sim, sigo pro build.
