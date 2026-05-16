# Pipeline mais rápido + CRM mais sólido (sem quebrar nada)

## Princípio condutor

**Zero regressão funcional.** Toda mudança é aditiva ou drop-in. Nenhuma feature, rota, hook público ou comportamento de UI muda. Se algo novo falhar, o caminho antigo continua funcionando (fallback automático). Critério de aceitação: testar manualmente Pipeline (kanban + filtros + descarte + aceite + parceria), Negócios, Roleta, WhatsApp Inbox e Tarefas — todos devem se comportar exatamente como hoje, só mais rápidos.

---

## Parte 1 — Diagnóstico

Mapeei a cadeia de carregamento do `/pipeline` e os pontos frágeis recorrentes do CRM.

**Cadeia atual (waterfall escondido):**

```text
useAuth → useUserRole → usePipeline
                          ├─ loadStages       (1 query)
                          ├─ loadSegmentos    (1 query)
                          └─ loadLeads        (paginado 1000 em 1000)
                                  ↓ (espera leads chegarem)
                          useQuery kanbanTarefasMap
                                  └─ fetchInBatchesWithRetry (chunks de 50, SEQUENCIAIS)
                                  ↓
                          + 3 queries de profiles/team_members
                          + useQuery visitas + parcerias
```

Para um gerente com ~3.000 leads vira **40+ round-trips encadeados**. Em Wi-Fi com qualquer latência, o tempo explode e os contadores piscam errado.

**Causas dos “bugs sozinhos” recentes:**

1. Sem cache persistente — qualquer F5 refaz tudo do zero.
2. `fetchInBatchesWithRetry` é serial — chunks rodam um após o outro.
3. Cada hook tem sua própria política de retry/timeout — comportamento inconsistente.
4. Queries N+1 em profiles + team_members.
5. Sem health-check global — quando a API flapa, cada hook spinner-eterniza sozinho.
6. Realtime + reload manual + reload em focus se sobrepõem.
7. Sem ErrorBoundary por rota — erro num sub-componente derruba a tela.

---

## Parte 2 — O que vou mudar (tudo aditivo, com fallback)

### A. Pipeline ~3× mais rápido

1. **Nova view SQL `v_pipeline_kanban`** (SECURITY INVOKER, respeita RLS): junta `pipeline_leads` + próxima `pipeline_tarefa` pendente numa consulta só. Elimina o waterfall leads → tarefas.
   - `usePipeline` tenta a view primeiro; **se falhar, cai no caminho atual** (paginação + `fetchInBatchesWithRetry`). Nenhum comportamento existente removido.
2. **Paralelizar `fetchInBatchesWithRetry`** — janelas de até 4 chunks com `Promise.all`. Mesma assinatura, mesmo fallback de split em caso de erro. Outros consumidores (parcerias, partner leads) ganham o speedup de graça.
3. **Cache persistente do React Query** via `@tanstack/react-query-persist-client` + IndexedDB. Reabrir o CRM mostra o pipeline instantâneo enquanto revalida em background (stale-while-revalidate).
   - Persistência **só** para queries marcadas como cacheáveis (whitelist). Queries sensíveis (auth, presença) ficam fora.
4. **`placeholderData`** no `usePipeline` lendo snapshot do cache — fim do tela-branca de 3s no F5.

### B. CRM mais sólido (vale pra todas as páginas)

5. **`QueryClient` global com defaults consistentes**: retry=2 com parada imediata em 401/403, `staleTime: 30s`, `networkMode: "offlineFirst"`. Já existe um QueryClient — só vou ajustar os defaults, sem trocar a instância nem mexer em hooks.
6. **`ErrorBoundary` por rota** em `AppLayout` (já existe um global) — erro isolado mostra "Recarregar esta seção" sem derrubar o app inteiro.
7. **Hook `useBackendHealth`** leve com `useQuery` (não interceptor de fetch — respeita a memória do bug de 13/05). Ping a cada 60s; após 2 falhas, mostra banner único “Reconectando…”.
8. **RPC `get_pipeline_user_context(user_id)`** devolve role + team_member_ids + profile_ids resolvidos em uma chamada. Hoje são 3-4 queries. Fallback: se a RPC falhar, segue o caminho atual.
9. **`withTimeout` extraído** para `src/lib/queryTimeout.ts` (mesmo helper que já existe inline em `usePipeline`) e reaproveitado em `useNegocios`, `useRoleta`, inbox do WhatsApp.

### C. Higiene (mudanças cirúrgicas)

10. Unir os dois `supabase.from("profiles")` em `usePipeline` numa só query com `.or(...)`.
11. `loadSegmentos` vira `useQuery` com `staleTime: 5min` (segmentos quase não mudam).
12. Subir `staleTime` de parcerias para 2min.

---

## Parte 3 — Garantias de não-regressão

- **Nenhum arquivo deletado.** Nenhum hook público (`usePipeline`, `useRoleta`, etc.) muda assinatura — só implementação interna.
- **Fallback automático** para view/RPC novas: se erro ou view inexistente, usa caminho atual sem alarde.
- **Feature flag local** (`localStorage.pipelineFastPath = "0"`) permite forçar o caminho antigo se algo der errado em produção.
- **Sem novos wrappers de fetch.** Cliente Supabase continua o auto-gerado de `@/integrations/supabase/client` (regra dura da memória — bug Wi-Fi 13/05).
- **Sem circuit breaker, sem segundo client, sem detector de offline novo.** O `useBackendHealth` é só `useQuery` leve, não toca em fetch.
- **Migrations agendadas fora de 08–19h BRT** (máximo 2/dia em horário comercial — regra de memória). A view e a RPC são read-only, sem alterar tabelas existentes.
- **Realtime, push, kill switch, version polling, SW resiliente** — tudo intocado.
- **Checklist de QA antes de fechar:** Pipeline carrega para Corretor/Gerente/CEO; descarte e aceite continuam funcionando; contadores estabilizam corretamente; drag-drop entre etapas funciona; filtros avançados funcionam; parceria continua exibindo leads do parceiro; modo Foco abre e lista os mesmos leads; reload manual funciona; realtime continua atualizando.

---

## Parte 4 — Detalhes técnicos

**Arquivos novos:**
- `src/lib/queryTimeout.ts` — `withTimeout` reusável.
- `src/lib/queryClientConfig.ts` — defaults centralizados.
- `src/lib/queryPersist.ts` — bootstrap do persister IndexedDB com whitelist.
- `src/hooks/useBackendHealth.ts` + `src/components/system/BackendHealthBanner.tsx`.
- Migration SQL: view `v_pipeline_kanban` (SECURITY INVOKER) + RPC `get_pipeline_user_context` (SECURITY DEFINER, set search_path = public).

**Arquivos alterados (cirurgicamente):**
- `src/main.tsx` — trocar `QueryClientProvider` por `PersistQueryClientProvider` com a mesma instância de QueryClient.
- `src/lib/taskQueryUtils.ts` — paralelizar chunks (mesma API).
- `src/hooks/usePipeline.ts` — tenta view + RPC; fallback para caminho atual; merge das duas queries de profiles.
- `src/pages/PipelineKanban.tsx` — quando a view trouxer próxima tarefa, `kanbanTarefasMap` vira `useMemo`; senão, mantém o `useQuery` atual.
- `src/components/AppLayout.tsx` — monta `<BackendHealthBanner />` + `<ErrorBoundary>` por outlet.

**Ganho esperado:**
- Primeiro carregamento (Wi-Fi instável): de ~6–15s para ~1–3s.
- F5 / reabrir aba: instantâneo (cache persistido) revalidando em background.
- Erros transitórios: deixam de quebrar a tela; banner único, auto-recovery.
- Sensação Pipedrive: dados aparecem na hora, atualizam silenciosamente.
