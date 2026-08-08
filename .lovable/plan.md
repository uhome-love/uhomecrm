# Nova Gestão Comercial — tarefa obrigatória → atividade real

Diagnóstico feito lendo o código e o banco. Nada foi alterado.

## B0 — respostas às perguntas

**A. Como a saúde do lead é calculada hoje**
Existem **dois cronômetros concorrentes**:

1. **Cor do card (Kanban)** — 100% derivada de `pipeline_tarefas`, não de contato real.
   `src/components/pipeline/CardMinimal.tsx:92-130`: vermelho = tarefa atrasada · verde = tarefa hoje/futura · **âmbar = sem tarefa pendente**. Mesma regra nos filtros (`PipelineAdvancedFilters.tsx`) e nos badges (`PipelineFiltroBadges.tsx`).
2. **Estagnação** — calculada no banco pelas RPCs `get_lead_estagnacao_status` / `get_pipeline_estagnacao`, sobre `pipeline_leads.estagnado`, `estagnado_aviso_em`, `estagnado_prazo_em` + `_pipeline_referencia_estagnacao` + `_pipeline_ultima_acao_humana`. Aparece no drawer (`EstagnacaoStatusCard.tsx`) e em `/leads-estagnados` (`usePipelineEstagnacao.ts`).
   Também depende de tarefa: tarefa pendente futura = **"protegido"**, pausa a contagem (`_pipeline_tem_tarefa_pendente_futura`); tarefa atrasada empurra a referência para `vence_em + 1 dia`.

Ou seja: hoje **criar uma tarefa "limpa" a saúde do lead sem nenhum contato ter acontecido**. É exatamente o vício que a virada quer eliminar.

**B. O que atualiza o "último toque"**
- `ultima_acao_at` está **poluído**: existe o trigger `trg_update_lead_ultima_acao` (BEFORE UPDATE em `pipeline_leads`, sem `WHEN`) que carimba `now()` em *qualquer* update — mudança de etapa, atribuição, edição de campo. O próprio código já reconhece isso (`src/hooks/useFocusLeads.ts:29`). Além dele, ~25 pontos do front escrevem o campo manualmente.
- `pipeline_atividades` **não** tem trigger que atualize o lead. Os triggers na tabela são só `trg_cadencia_sc_avancar_acao` e `trg_perf_primeiro_contato`.
- `ultimo_toque_at` já existe e é gravado **só** por `src/lib/registrarToque.ts` (chamado em QuickActionMenu, WhatsApp, conclusão de tarefa). **Nenhuma régua/UI lê a coluna** — é write-only hoje. É a base limpa para a saúde por toque, mas **a cobertura precisa ser medida antes de virar a chave**.

**C. Dependência de `pipeline_tarefas` nos KPIs**
`src/lib/taskBuckets.ts` (regra canônica) → `useCorretorKpisCarteira.ts` (`tarefas_hoje / tarefas_atrasadas / leads_sem_tarefa / leads_em_dia`) → `CarteiraKpis.tsx`, `CaminhosCards.tsx`; e `useTarefasHoje.ts` → `TarefasHojeLateral.tsx`.
Se tarefa deixar de significar saúde, quebram junto: cor do card, filtros do Kanban, os 4 KPIs de carteira e a "proteção" da estagnação.

**D. Cadência Sem Contato**
`trg_cadencia_sc_stage` cria o estado em `lead_cadencia_sem_contato` e a 1ª tarefa (`origem='cadencia_sem_contato'`) ao entrar na etapa. O avanço é **derivado de tarefa concluída**: `fn_cadencia_sc_recalcular_por_tarefas` conta tarefas `origem='cadencia_sem_contato' AND status='concluida'` (até 7), cria a próxima e, em T7, marca `aguardando_descarte`. `fn_cadencia_sc_avancar_acao` (em `pipeline_atividades`) está explicitamente neutralizada: atividade humana **não** avança tentativa. Concluir = só marcar a tarefa como concluída.
Isto é o oposto do modelo novo — a cadência precisa passar a avançar por **atividade**, não por checkbox.

**E. Playbook por etapa — já está morto**
A função `trg_pipeline_playbook_on_stage_change()` existe, mas **nenhum trigger está anexado a ela** (0 linhas em `pg_trigger`). `pipeline_playbooks` (3) e `pipeline_playbook_tarefas` (8) têm dados, e 0 tarefas geradas em 90 dias. Não há o que desligar: só remover UI e código morto.

**F. Onboarding reutilizável**
Sim: `corretor_onboarding` + `src/hooks/useOnboarding.ts` (steps hardcoded + auto-detecção) + `OnboardingWidget.tsx` / `src/pages/Onboarding.tsx`. Serve para o "O CRM mudou" — basta um step novo, sem tabela nova.

**G. Notificar lembrete na hora**
A entrega já existe ponta a ponta: `criar_notificacao` → `notifications` → trigger `trg_push_on_notification` → edge `send-push` → `push_subscriptions`. **Falta apenas o agendador** que varra `pipeline_tarefas` por `vence_em + hora_vencimento` e dispare. Padrão a copiar: `stalled-deals-notify`.

**F(reconciliação). Saúde por toque x estagnado**
São **dois sinais concorrentes** hoje (cor por tarefa + estagnação por RPC). A unificação correta é: **um único relógio = `ultimo_toque_at`**; "estagnado" deixa de ser um segundo cronômetro e vira apenas o **estágio final** do mesmo relógio (tranquilo → esfriando → frio → estagnado), sem a "proteção por tarefa futura".

---

## Trilha B (dados/cálculo) x Trilha A-Dependent (UI)

| Item | Trilha B | Trilha A-Dependent |
|---|---|---|
| Saúde por toque | `ultimo_toque_at` confiável + função canônica de faixa | cor do card, filtros, badges |
| ⚡ Atividade central | trigger `pipeline_atividades → ultimo_toque_at` | modal ⚡ único, oferta de lembrete |
| Lembrete inerte | `pipeline_tarefas.tipo='lembrete'` sem efeito em saúde | agenda, drawer, dashboard |
| Sem Contato | avanço por atividade | card vira nudge |
| KPIs | nova RPC de carteira por toque | CorretorDashboard / GerenteDashboard |

---

## Plano faseado

### Fase 0 — B0: instrumentação, sem virar chave (1 migration)
- Trigger `AFTER INSERT ON pipeline_atividades` → carimba `ultimo_toque_at` (e nada mais) quando a atividade é de contato humano.
- Backfill único de `ultimo_toque_at` a partir de `_pipeline_ultima_acao_humana` (atividades, anotações, whatsapp, visitas) — não usar `ultima_acao_at`.
- **Painel-sombra** (só leitura, escondido atrás de flag/role admin): comparar, por corretor, a saúde-por-tarefa atual x saúde-por-toque. Rodar ~1 semana antes da Fase 1.
- Não tocar: `trg_update_lead_ultima_acao`, cadência, RLS de `pipeline_tarefas`.
- Arquivos: novo `src/lib/leadSaude.ts` (função pura de faixa, BRT via `@/lib/brtTime`), nova aba admin de comparação.

### Fase 1 — ⚡ central + saúde por toque + agenda
- `⚡ Registrar atividade` vira **modal único** com `tipo_contato` + `resultado`, reaproveitando `QuickActionMenu.tsx` e `FocusModeModal`; ao final, oferta pulável de lembrete (amanhã / 2 dias / semana).
- `CardMinimal.tsx` passa a colorir por `ultimo_toque_at` (faixas por etapa); filtros e badges seguem a mesma função de `src/lib/leadSaude.ts`.
- Nova **Agenda do corretor** agregando as 4 fontes (lembretes · confirmar visitas · nudge Sem Contato · leads esfriando), só leitura.
- Migration: cron + edge `lembrete-notify` (varre `vence_em`+`hora_vencimento` em BRT, chama `criar_notificacao`).
- Risco: leads sem histórico ficam "frios" no dia 1 — mitigado pelo backfill da Fase 0.

### Fase 2 — tarefa → lembrete, Sem Contato re-surge, playbook aposentado
- Tarefas manuais existentes migram para `tipo='lembrete'`; concluir lembrete deixa de mexer em saúde (retirar `registrarToque`/`ultima_acao_at` de `completeLeadTask.ts` e `taskCompletion.ts`).
- Cadência Sem Contato: `fn_cadencia_sc_recalcular_por_tarefas` deixa de contar tarefas concluídas e passa a contar **atividades registradas** (reativando `fn_cadencia_sc_avancar_acao` com a nova regra). O card vira nudge na agenda; "resolver" = ⚡.
- Estagnação: remover a "proteção por tarefa futura" de `_pipeline_referencia_estagnacao` / `_pipeline_tem_tarefa_pendente_futura` e passar a referência para `ultimo_toque_at`.
- Playbook: remover UI e a função órfã (não há trigger ativo).

### Fase 3 — consolidar
- KPIs novos: **% da carteira em dia** e **leads atualizados hoje (BRT)** substituem "sem tarefa" em `taskBuckets.ts`, `useCorretorKpisCarteira.ts`, CorretorDashboard e GerenteDashboard.
- Step "O CRM mudou" em `useOnboarding.ts` + `OnboardingWidget`.
- Limpeza: aposentar as escritas manuais redundantes de `ultima_acao_at` e avaliar restringir `trg_update_lead_ultima_acao`.

---

## Não tocar
RLS de `pipeline_tarefas` (duplicada, fora de escopo) · regras de VGV / `v_pdn_linhas` / Vendas Realizadas · Roleta e Oferta Ativa · `team_members` como fonte de hierarquia · papéis reais (`admin` = CEO).

## Decisões de produto que preciso de você
1. **Limiares de "em dia" por etapa** (sugestão: Novo Lead 1d · Sem Contato 1d · Qualificação 3d · Aquecimento 7d · Visita 3d · Negociação 5d · Contrato 7d).
2. **O que conta como toque**: só ligação/WhatsApp/e-mail/visita, ou anotação também conta?
3. **WhatsApp automático/HOMI conta como toque?** (recomendo: não — só humano).
4. Lembrete vencido e não cumprido: aparece atrasado na agenda ou some?
5. "Estagnado" continua existindo como estágio final do mesmo relógio (recomendado) ou vira só rótulo do gestor?
