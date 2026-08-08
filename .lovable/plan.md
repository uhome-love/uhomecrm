# Nova Gestão Comercial — tarefa obrigatória → atividade real (versão definitiva)

Decisões fechadas incorporadas. Nada foi editado no código.

## Diagnóstico (B0 — confirmado lendo código e banco)

- **Cor do card hoje = tarefa, não contato.** `src/components/pipeline/CardMinimal.tsx:92-130`: vermelho = tarefa atrasada · verde = tarefa hoje/futura · âmbar = sem tarefa. Mesma regra em `PipelineAdvancedFilters.tsx` e `PipelineFiltroBadges.tsx`. Criar tarefa "limpa" o lead sem nenhum contato ter acontecido.
- **Segundo cronômetro:** estagnação via RPCs `get_lead_estagnacao_status` / `get_pipeline_estagnacao` sobre `estagnado`, `estagnado_aviso_em`, `estagnado_prazo_em` + `_pipeline_referencia_estagnacao` / `_pipeline_ultima_acao_humana`, com "proteção" quando existe tarefa futura (`_pipeline_tem_tarefa_pendente_futura`).
- **`ultima_acao_at` é inutilizável como toque:** trigger `trg_update_lead_ultima_acao` (BEFORE UPDATE, sem WHEN) carimba `now()` em qualquer update do lead, e ~25 pontos do front escrevem manualmente.
- **`ultimo_toque_at` existe e está limpo, mas é write-only:** só `src/lib/registrarToque.ts` grava; nenhuma régua lê.
- **`pipeline_atividades` não atualiza o lead** (triggers na tabela: só `trg_cadencia_sc_avancar_acao` e `trg_perf_primeiro_contato`).
- **KPIs presos a tarefa:** `src/lib/taskBuckets.ts` → `useCorretorKpisCarteira.ts` (`leads_sem_tarefa`, `leads_em_dia`) → `CarteiraKpis.tsx`, `CaminhosCards.tsx`, `useTarefasHoje.ts`.
- **Cadência Sem Contato avança por tarefa concluída** (`fn_cadencia_sc_recalcular_por_tarefas`, 7 passos → `aguardando_descarte`); `fn_cadencia_sc_avancar_acao` está explicitamente neutralizada ("atividades humanas NÃO avançam tentativa").
- **Playbook por etapa já está morto:** a função `trg_pipeline_playbook_on_stage_change()` existe mas **nenhum trigger está anexado** (0 linhas em `pg_trigger`); 0 tarefas geradas em 90 dias.
- **Notificação:** entrega pronta (`criar_notificacao` → `notifications` → `trg_push_on_notification` → edge `send-push` → `push_subscriptions`). Falta só o agendador por horário de tarefa.
- **.ics: não existe nada reaproveitável.** `src/pages/VisitaConfirmacao.tsx` não gera arquivo de calendário; o que existe é OAuth Google (`calendar-create-event`, `google-oauth-*`, `corretor_calendar_integrations`) — outro caminho, que fica parqueado.

### Conflitos entre as decisões e o código
1. **"Visita agendada conta como toque"** — hoje o agendamento não chama `registrarToque`. Precisa de trigger em `visitas` (INSERT) e não só na realização.
2. **"Concluir lembrete não conta como toque"** — hoje `completeLeadTask.ts` / `taskCompletion.ts` chamam `registrarToque` e escrevem `ultima_acao_at`. Tem que sair na Fase 2.
3. **"Sem Contato estagna pela cadência"** — a cadência hoje avança por **tarefa concluída**, não por atividade. Precisa inverter para contar `pipeline_atividades` (Fase 2), senão o corretor que liga de verdade não avança tentativa.
4. **Estagnação por etapa** — `pipeline_estagnacao_config` é por etapa, então o recorte (só SC/Qualificação/Aquecimento, 21d) cabe sem mudar estrutura: basta zerar/desligar a config das demais.
5. **Denominador do "% em dia"** — hoje não existe RPC única; cada tela calcula do seu jeito. Precisa nascer na Fase 0/1.

---

## Regras definitivas (cravadas)

**Prazo "em dia" por etapa (dias sem toque):**

| Etapa | Prazo |
|---|---|
| Novo Lead | 1d |
| Sem Contato | 2d |
| Qualificação | 7d |
| Aquecimento | 15d |
| Visita | 2d |
| Em Negociação | 7d |
| Contrato | 7d |

Cores: dentro do prazo = verde · até 2× o prazo = âmbar · acima = vermelho.

**Relógio (borda 1):** `COALESCE(ultimo_toque_at, distribuido_em, stage_changed_at, created_at)`. Lead novo conta desde a chegada; nunca fica "sem cor".

**Etapas terminais (borda 2):** Ganho, Caiu e Descarte (e `arquivado = true`) ficam **fora do colorido e fora do denominador** do "% em dia".

**Toque conta:** ligação · WhatsApp do corretor · e-mail · **visita agendada** (no momento do agendamento) · visita realizada · ⚡ atividade registrada.
**Toque NÃO conta:** anotação · HOMI/automático/campanha · criar ou concluir lembrete · mudança de etapa.

**Estagnação (ponto de decisão, nunca descarte automático):** só em **Sem Contato** (pela cadência existente: 7 tentativas → `aguardando_descarte`, **não** pelos 21d — borda 4), **Qualificação** e **Aquecimento** (21 dias sem toque). Visita, Em Negociação e Contrato coloriram pelo toque e **nunca** estagnam sozinhos.

**Visita distante (borda 3):** o agendamento carimba o toque; se a visita é daqui a 20 dias e a etapa Visita esfria em 2d, o lead **esfria mesmo** — a cobertura é o item "confirmar visita" na agenda, que aparece no dia certo. Não seguramos verde artificialmente. Abordagem confirmada.

**Fórmula única de "% em dia" (borda 5):**
`leads ativos (não terminais, não arquivados) cujo relógio está dentro do prazo da etapa ÷ leads ativos`.
Vive em **uma** função SQL: `public.lead_saude(lead)` (faixa por etapa) + RPC `rpc_carteira_saude(p_escopo, p_user_id)` que devolve `total / em_dia / esfriando / frio / pct_em_dia`. Corretor, gestor e CEO chamam a **mesma** RPC, mudando só o escopo (self / equipe via `team_members` / geral). Espelho em TS: `src/lib/leadSaude.ts` (mesmos limiares, BRT via `@/lib/brtTime`).

**Lembrete:** `pipeline_tarefas.tipo='lembrete'`, inerte para a saúde. Vencido e não cumprido **fica visível como atrasado** na agenda. Oferta pós-⚡ (pulável): Amanhã · Em 2 dias · Semana que vem · **Escolher data** · Agora não.

---

## Fase 0 — instrumentação e painel-sombra (1 migration)

**Migration 1**
- Trigger `AFTER INSERT ON pipeline_atividades` → carimba `ultimo_toque_at` só para tipos de contato humano (não HOMI/automático).
- Trigger `AFTER INSERT ON visitas` → carimba `ultimo_toque_at` (visita agendada = toque).
- Backfill único de `ultimo_toque_at` a partir de atividades / WhatsApp saída do corretor / visitas — **nunca** de `ultima_acao_at`.
- `public.lead_saude_prazo(stage_tipo)` + `public.lead_saude(lead_id)` (função de faixa) e `rpc_carteira_saude`.

**Sem migration**
- `src/lib/leadSaude.ts` (espelho TS puro dos limiares).
- **Painel-sombra** (rota admin, escondida): por corretor, saúde-por-tarefa atual × saúde-por-toque nova + % de leads sem `ultimo_toque_at`. Roda ~1 semana. **É o gate da borda 6** — só viramos a chave quando a cobertura estiver aceitável.

**Não tocar:** `trg_update_lead_ultima_acao`, cadência, playbook, RLS de `pipeline_tarefas`.
**Risco:** backfill subestimar toques antigos → mitigado pelo período de sombra.

## Fase 1 — ⚡ central + saúde por toque + agenda (1 migration)

- **⚡ Registrar atividade** vira modal único (`tipo_contato` + `resultado`), reaproveitando `QuickActionMenu.tsx` e o fluxo do `FocusModeModal`; ao final, oferta pulável de lembrete com as 5 opções (incl. data personalizada).
- **Concluir lembrete → prompt do ⚡ (ajuste novo, só frontend).** Ao marcar um lembrete concluído, aparece "Registrou o contato? [⚡ Registrar] [Só concluir]".
  - "Só concluir": marca `status='concluida'` e **nada mais** — sem atividade, sem toque, sem cor.
  - "⚡ Registrar": abre o modal ⚡; quem carimba o toque é o INSERT em `pipeline_atividades` (trigger da Fase 0), nunca o completar do lembrete.
  - Arquivos: `src/lib/completeLeadTask.ts`, `src/lib/taskCompletion.ts`, `src/components/pipeline/task-completion/TaskCompletionDialog.tsx`, `src/components/corretor/TarefasHojeLateral.tsx`, `src/pages/MinhasTarefas.tsx`, `CardMinimal.tsx` (atalho de check).
  - **Gotcha crítico:** hoje `completeLeadTask.ts` **sempre** insere em `pipeline_atividades` ao concluir qualquer tarefa (linhas ~72-84) além de chamar `registrarToque` e escrever `ultima_acao_at`. Com o trigger da Fase 0 no ar, concluir lembrete passaria a carimbar toque **automaticamente**. Portanto o caminho "lembrete" precisa ser separado já na Fase 1: sem INSERT de atividade, sem `registrarToque`, sem `ultima_acao_at`. Isso antecipa parte da limpeza da Fase 2 e é a condição para o invariante valer.
- `CardMinimal.tsx`, `PipelineAdvancedFilters.tsx`, `PipelineFiltroBadges.tsx` passam a usar `src/lib/leadSaude.ts`. Etapas terminais sem cor.
- **Agenda do corretor** agrega 4 fontes (lembretes · confirmar visitas · nudge Sem Contato · leads esfriando), somente leitura; lembrete vencido aparece como atrasado.
- **Migration 2:** cron + edge function `lembrete-notify` (varre `pipeline_tarefas` por `vence_em` + `hora_vencimento` em BRT, chama `criar_notificacao`; entrega já existente até o push). Auth via `_shared/cron-auth.ts`.
- **Botão "Adicionar à agenda" (.ics)** nas visitas — gerado 100% no client (`Blob` + download), sem OAuth, sem backend. Não existe nada reaproveitável hoje; é código novo pequeno em `src/lib/icsVisita.ts` + botão em `VisitaRow.tsx` e `VisitaConfirmacao.tsx`. Webcal e Google OAuth: **parqueados**.
- **Risco:** virada de cor é visível para o time todo — publicar junto do aviso de mudança.

## Fase 2 — tarefa vira lembrete, Sem Contato re-surge, playbook aposentado (2 migrations, dias separados)

- Tarefas manuais existentes migram para `tipo='lembrete'`; `completeLeadTask.ts` e `taskCompletion.ts` **param** de chamar `registrarToque`, de escrever `ultima_acao_at` e de inserir atividade no caminho lembrete (o caminho ⚡ continua inserindo).
- **Migration 3 — cadência Sem Contato com auto-lembretes, avanço por atividade.**
  - Os 7 passos continuam materializados como tarefas, mas com `tipo='lembrete'` + `origem='cadencia_sem_contato'` (**auto-lembrete**): aparecem na agenda, são inertes para a saúde.
  - `fn_cadencia_sc_recalcular_por_tarefas` **deixa de contar tarefas concluídas**; `fn_cadencia_sc_avancar_acao` (em `pipeline_atividades`) volta a avançar `tentativa_atual` a partir de atividades humanas do lead na etapa Sem Contato. Ao avançar, cancela o auto-lembrete pendente e cria o do passo seguinte (T+1); em T7 → `aguardando_descarte`.
  - **Concluir ou dispensar o auto-lembrete não avança a cadência e não conta toque** — só some da agenda; a cadência recria o passo corrente na próxima varredura se a tentativa não avançou.
  - **Gotcha "tarefa-fantasma":** hoje existe `trg_cadencia_sc_recalcular_tarefas` em `pipeline_tarefas` (INSERT/UPDATE/DELETE) chamando o recálculo a cada mexida em qualquer tarefa do lead — é exatamente o que geraria lembrete duplicado ao concluir. Esse trigger tem de ser **dropado** nesta migration; o recálculo passa a ter dois gatilhos apenas: entrada na etapa (`fn_cadencia_sc_stage`) e nova atividade.
  - `CadenciaSemContatoCard.tsx` vira nudge na agenda; "resolver" = ⚡. Fim de relógio único: SC estagna pela cadência, não pelos 21d.
- **Migration 4:** estagnação unificada — `_pipeline_referencia_estagnacao` passa a usar o relógio de toque, remove-se a "proteção por tarefa futura" (`_pipeline_tem_tarefa_pendente_futura`), e `pipeline_estagnacao_config` fica ativa **só** em Sem Contato, Qualificação (21d) e Aquecimento (21d). Drop da função órfã de playbook.
- Frontend: remover UI de playbook; `EstagnacaoStatusCard.tsx` deixa de falar em "tarefa agendada — contagem pausada".
- **Risco:** alterar a cadência mexe em fluxo com 7 passos em produção — validar em lead de teste no preview antes de publicar.

## Fase 3 — consolidar KPIs e comunicar

- `taskBuckets.ts` / `useCorretorKpisCarteira.ts` / `CarteiraKpis.tsx` / `CaminhosCards.tsx` / CorretorDashboard / GerenteDashboard / dashboards CEO passam a consumir `rpc_carteira_saude`: **% da carteira em dia** e **leads atualizados hoje (BRT)** substituem "sem tarefa".
- Onboarding "O CRM mudou": novo step em `src/hooks/useOnboarding.ts` + `OnboardingWidget.tsx` (infra `corretor_onboarding` já existe, sem tabela nova).
- Limpeza: aposentar as escritas manuais redundantes de `ultima_acao_at` e avaliar restringir `trg_update_lead_ultima_acao`.

---

## O que NÃO tocar
RLS de `pipeline_tarefas` (duplicada, fora de escopo) · VGV / `v_fato_venda` / `v_pdn_linhas` / Vendas Realizadas · Roleta e Oferta Ativa · `team_members` como fonte única de hierarquia · papéis reais `admin/diretor/gestor/corretor/backoffice/rh` · Google Calendar OAuth (parqueado).

## Regras de execução
Máx 2 migrations/dia, 08–19h BRT · BRT em toda lógica temporal (`@/lib/brtTime`) · 1 mudança por rodada · validar no preview antes de publicar · Fase 1 só começa depois que o painel-sombra da Fase 0 confirmar a cobertura de `ultimo_toque_at`.
