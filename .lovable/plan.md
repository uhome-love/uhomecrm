## Bugs do CRM — plano de correção

### 1. Integração Pipeline ↔ Agenda de Visitas
**Problema:** Visita criada pelo modal do lead não aparece na Agenda; visita criada na Agenda não atualiza o pipeline.

**Correção:**
- `CardScheduleVisitDialog.tsx`: usar `useQueryClient` e invalidar `["visitas"]`, `["agenda-widget-leads"]`, `["pipeline-leads"]` após o insert. Atualizar também `pipeline_leads.ultima_acao_at`.
- `useVisitas.ts` (`createVisita`/`updateVisita`/`updateStatus`/`deleteVisita`): invalidar `["pipeline-leads"]`, `["pipeline-tarefas"]` e `["agenda-widget-leads"]` para refletir no detalhe do lead e no widget da rotina.
- `VisitaForm`: ao criar visita vinculada a `pipeline_lead_id`, garantir que o `ultima_acao_at` do lead seja atualizado.

### 2. Oferta Ativa — escolher data e horário da visita
**Problema:** Visita marcada via Oferta Ativa sempre é agendada para o dia atual sem horário.

**Correção:**
- Adicionar campos opcionais `data_visita` e `hora_visita` em `createVisitaFromOA` (`useVisitas.ts`).
- `AttemptModal.tsx` e `CustomListAttemptModal.tsx`: quando o corretor selecionar "Visita marcada", revelar inline um DatePicker + Input `time` (default = amanhã 10:00). Bloquear datas passadas.
- `DialingModeWithScript.tsx`: repassar `data` e `hora` escolhidos para `createVisitaFromOA`.
- Fallback (sem data preenchida) mantém comportamento atual (hoje), para não quebrar fluxos antigos.

### 3. Filtro "Tipos" em /imoveis — Apartamento Garden e Casa em Condomínio
**Correção:**
- Localizar definição do filtro de tipos (provável: componente que consome `imoveisSearchStore.tipo`, em `ImoveisPage.tsx` ou `SiteFilterPill.tsx`).
- Adicionar opções "Apartamento Garden" e "Casa em Condomínio" (verificar com `read_query` quais valores reais existem na coleção Typesense `imoveis` no campo `tipo` — possivelmente "garden", "casa_condominio" ou variantes — e mapear label↔valor corretamente).
- Testar a busca abrindo /imoveis e selecionando cada tipo, validando que retorna resultados.

### 4. Setas das fotos no detalhe do imóvel
**Problema:** No `PhotoLightbox`, navegação só com teclado; clique do mouse não funciona.

**Correção em `PhotoLightbox.tsx`:**
- Remover/atenuar o gate `if (isTransitioning) return;` no `goTo` (re-renders externos podem mantê-lo travado em `true`). Substituir por debounce simples por timestamp (ex.: ignorar cliques < 100 ms entre si).
- Garantir z-index dos botões de navegação acima de qualquer overlay do drawer pai (`z-[10001]`) e adicionar `pointer-events-auto`.
- Confirmar que `e.preventDefault()` + `e.stopPropagation()` estão nos `onClick` das setas.
- Testar manualmente: abrir imóvel → abrir fotos → clicar nas setas.

### 5. Modo Foco — tarefas do lead atual visíveis e acionáveis
**Comportamento desejado:** ao puxar um lead no foco, exibir todas as tarefas **pendentes** dele (com destaque visual para atrasadas), permitindo concluir e criar nova sem sair do modal.

**Correção em `FocusModeModal.tsx`:**
- Para o `currentLead`, fazer query em `pipeline_tarefas` (status `pendente`, `pipeline_lead_id` = lead atual) ordenada por `vence_em`.
- Renderizar bloco "📋 Tarefas do lead" com cards: badge vermelho "🔴 Atrasada" para `vence_em < hoje` (BRT, regra SLA) e cinza para futuras.
- Cada card tem botão "✅ Concluir" → abre `TaskCompletionDialog` inline (já existe e suporta criar próxima tarefa).
- Botão "➕ Nova tarefa" no topo do bloco → reusar `CardQuickTaskPopover` ou um mini-form interno.
- Após concluir/criar, invalidar caches (`["pipeline-tarefas"]`, `["focus-leads"]`) e re-renderizar a lista.

### 6. Aba "Minha Rotina" — tarefas atrasadas incorretas + clique abre lead
**Problemas:** `MinhaAgendaWidget` marca tarefas como atrasadas mesmo quando não estão; cards não abrem o detalhe do lead.

**Correção em `MinhaAgendaWidget.tsx`:**
- Revisar `classify()`: usar helpers de `@/lib/brtTime` (`startOfDayBRT`, `nowBRT`) em vez de `parseDateBRT` solto, para garantir comparação consistente em BRT. Quando `hora_vencimento` for `null`, considerar deadline 23:59 BRT (regra SLA já documentada).
- Para tarefas com `vence_em = hoje` e `hora_vencimento` no futuro → status "próxima", nunca "atrasada".
- Tornar cada `renderTarefa` clicável: `onClick` navega para `/pipeline?leadId=<pipeline_lead_id>` (ou `/negocios?id=...` para `_source === "negocio"`), e o pipeline auto-abre o `PipelineLeadDetail` por query param. Validar se já existe esse handshake; se não, adicionar leitura do `searchParams` em `PipelineKanban.tsx`.

### 7. Notificação "lead precisa atualização" — excluir leads com Venda Realizada
**Correção:**
- Localizar a função/cron que gera a notificação (candidatos: edge functions `lead-escalation`, `stalled-deals-notify`, ou job que escreve em `notifications` por `ultima_acao_at`).
- Adicionar filtro: excluir leads cujo stage atual seja "Venda Realizada" (verificar nome canônico em `pipeline_stages`; provavelmente `tipo = 'convertido'` ou similar). Manter alertas para "Negócio Criado" e "Contrato Assinado" (apenas Venda Realizada é o terminal).
- Também limpar notificações existentes desses leads via migration (DELETE `notifications` onde `categoria` é de "atualização" e o lead correspondente está em Venda Realizada).

---

### Arquivos previstos para edição
- `src/components/pipeline/CardScheduleVisitDialog.tsx`
- `src/hooks/useVisitas.ts`
- `src/components/visitas/VisitaForm.tsx` (se necessário)
- `src/components/oferta-ativa/AttemptModal.tsx`, `CustomListAttemptModal.tsx`, `DialingModeWithScript.tsx`
- `src/stores/imoveisSearchStore.ts` + componente que renderiza pills de tipo
- `src/components/imoveis/PhotoLightbox.tsx`
- `src/components/pipeline/FocusModeModal.tsx`
- `src/components/corretor/MinhaAgendaWidget.tsx`
- `src/pages/PipelineKanban.tsx` (suporte a `?leadId=` se faltar)
- Edge function de notificações de leads parados (a confirmar via inspeção) + migration de limpeza

### Validações antes de finalizar
- Conferir nomes/`tipo` dos stages "Venda Realizada" via `read_query` no `pipeline_stages`.
- Conferir valores reais de `tipo` na coleção Typesense `imoveis` para mapear corretamente "Apartamento Garden" e "Casa em Condomínio".
- Testar visualmente: criar visita por pipeline → ver na agenda; criar pelo modo foco → concluir tarefa; abrir foto e clicar na seta.
