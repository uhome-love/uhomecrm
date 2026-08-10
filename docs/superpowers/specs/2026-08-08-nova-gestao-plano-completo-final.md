# Nova Gestão Comercial — Plano Completo Final
### UhomeSales · tarefa obrigatória → atividade real · Onda 1

> Versão definitiva, fechada e verificada contra o código em 08/08/2026. Consolidada das decisões do Lucas, do diagnóstico e do plano faseado do Lovable (plan_mode, nada editado), e dos dois ajustes finos verificados.
> Lovable: `uhomeia` · id `6e97ca96-8d59-451c-8ca6-c1b3d18c3c30` · workspace `LaSzRc52cex1o4iQCJdd` · produção `uhomesales.com`.

---

## 1. Por que estamos fazendo isso

Hoje o CRM mede o corretor por **tarefa**, não por **contato real**. A cor do lead depende da existência de uma tarefa aberta — então o corretor cria e cancela tarefa só pra não ficar no vermelho. O número infla, a gestão coacha em cima de dado falso, e o lead que importa esfria sem ninguém ver.

A virada troca a base: **a saúde do lead passa a refletir o último toque de verdade.** Sem isso, todo dashboard acima (corretor, gestor, CEO) mente. Corrigir a base é o que faz o resto valer.

**O que a mudança entrega:** menos trabalho pro corretor (registrar em vez de burocratizar), dado verdadeiro pra gestão, e — o principal — parar de deixar vazar o lead que a empresa já pagou.

---

## 2. A regra de ouro (não se quebra)

> **O lembrete é um post-it na agenda. Ele não conta como atividade e não muda a cor do lead.**
> A **única** ação que atualiza o "último toque" e a saúde é o **⚡ Registrar atividade** (contato real).

Isso é o que impede o corretor de "enganar" o sistema e é o que torna o dado de conversão verdadeiro.

---

## 3. O modelo completo

**Saúde por toque.** A cor/atenção do lead vem do último contato real (`ultimo_toque_at`), medido por um relógio único: **Em dia → Esfriando → Frio → Estagnado**. Mesma cor no card, no filtro e no KPI.

**⚡ Registrar atividade.** Ação central no lead (ligação, WhatsApp, e-mail, visita). Grava em `pipeline_atividades` e é o único gatilho que carimba o toque e deixa o lead verde. Depois de registrar, oferece (pulável) marcar um **retorno**: Amanhã · Em 2 dias · Semana que vem · **Escolher data** · Agora não.

**Lembrete.** `pipeline_tarefas` com `tipo='lembrete'`, criado pelo corretor. Inerte para a saúde — só aparece na agenda. Vencido e não cumprido, **fica visível como atrasado** (não some). Ao concluir um lembrete, aparece **"Registrou o contato? [⚡ Registrar] [Só concluir]"** — o ⚡ é opcional e é ele que atualiza; "Só concluir" não muda nada.

**Agenda do corretor.** O novo "home" (no lugar do balde de tarefas). Agrega 4 fontes, só exibe (não é fonte de saúde): lembretes · confirmar visitas · nudge "registrar contato" (cadência Sem Contato) · leads esfriando (saúde por toque).

**Cadência Sem Contato.** Continua viva, mas re-surge como **auto-lembretes** na agenda. O que avança a tentativa e conta como toque é a **atividade ⚡**, nunca o concluir do auto-lembrete.

**Metas / cockpit em cascata.** A métrica vira **% da carteira em dia** + leads atualizados. Mesma fórmula em 3 altitudes: corretor (minha carteira) → gestor (equipe) → CEO/diretoria (empresa), via uma única RPC.

---

## 4. Decisões finais (cravadas)

**Prazo de "em dia" por etapa (dias sem toque):**

| Etapa | Em dia até | Estagnação |
|---|---|---|
| Novo Lead | 1 dia | não estagna |
| Sem Contato | 2 dias | pela **cadência** (7 tentativas → aguardando descarte) |
| Qualificação | 7 dias | **21 dias** sem toque |
| Aquecimento | 15 dias | **21 dias** sem toque |
| Visita | 2 dias | não estagna |
| Em Negociação | 7 dias | não estagna |
| Contrato | 7 dias | não estagna |

Cores: dentro do prazo = **verde** · até 2× o prazo = **âmbar** · acima = **vermelho**.

**Relógio:** `COALESCE(ultimo_toque_at, distribuido_em, stage_changed_at, created_at)` — lead novo conta desde a chegada, nunca fica "sem cor".

**Estagnação** = ponto de decisão (nunca descarte automático), só em Sem Contato, Qualificação e Aquecimento. Visita, Negociação e Contrato coloriram pelo toque mas nunca estagnam sozinhos (negócio avançado é decisão do gestor).

**O que conta como toque:** ligação · WhatsApp do corretor · e-mail · **visita agendada** · visita realizada · ⚡ atividade registrada.
**O que NÃO conta:** anotação · HOMI/automático/campanha · criar ou concluir lembrete · mudar de etapa.

**Etapas terminais** (Ganho, Caiu, Descarte, `arquivado`) ficam fora do colorido e fora do denominador do "% em dia".

**Notificação + agenda do celular:** push do lembrete no horário (infra já existe, falta só o agendador) + botão **"Adicionar à agenda" (.ics)** nas visitas. Feed webcal e Google Calendar OAuth **parqueados** (obs.: o OAuth já existe no código — pode ser barato no futuro).

---

## 5. Diagnóstico do código (B0 — confirmado pelo Lovable)

- **Cor do card hoje = tarefa, não contato** (`CardMinimal.tsx:92-130`; idem `PipelineAdvancedFilters`, `PipelineFiltroBadges`). Criar tarefa "limpa" o lead sem contato.
- **Segundo cronômetro:** estagnação via RPCs `get_lead_estagnacao_status`/`get_pipeline_estagnacao`, com "proteção por tarefa futura" (`_pipeline_tem_tarefa_pendente_futura`).
- **`ultima_acao_at` poluído** (trigger `trg_update_lead_ultima_acao` carimba em qualquer update) — **não usar**.
- **`ultimo_toque_at` existe e está limpo, mas é write-only** (só `registrarToque.ts` grava; nada lê). É a base da saúde por toque.
- **`pipeline_atividades` não atualiza o lead** hoje.
- **Cadência Sem Contato avança por tarefa concluída** (`fn_cadencia_sc_recalcular_por_tarefas`); `fn_cadencia_sc_avancar_acao` está neutralizada.
- **Playbook já morto** (função sem trigger anexado; 0 tarefas em 90 dias).
- **Notificação pronta** (`criar_notificacao → notifications → trg_push_on_notification → send-push → push_subscriptions`); falta o agendador.
- **.ics** não existe; Google OAuth (`calendar-create-event`, `corretor_calendar_integrations`) existe.

**Conflitos decisão × código (todos resolvidos no plano):**
1. Visita agendada não grava toque hoje → trigger `AFTER INSERT visitas` (Fase 0).
2. Concluir qualquer tarefa hoje **insere atividade** + `registrarToque` + `ultima_acao_at` (`completeLeadTask.ts` ~72-84) → concluir lembrete carimbaria toque sozinho. **Separar o caminho lembrete já na Fase 1.**
3. Cadência avança por tarefa concluída → inverter para atividade (Migration 3).
4. Estagnação é por etapa (`pipeline_estagnacao_config`) → desligar a config das etapas que não estagnam.
5. Não existe RPC única de "% em dia" → criar `rpc_carteira_saude`.

---

## 6. Plano faseado

### Fase 0 — Instrumentação e painel-sombra · 1 migration
- Trigger `AFTER INSERT ON pipeline_atividades` → carimba `ultimo_toque_at` (só contato humano, não HOMI/automático).
- Trigger `AFTER INSERT ON visitas` → carimba `ultimo_toque_at` (visita agendada = toque).
- **Backfill** único do `ultimo_toque_at` a partir de atividades / WhatsApp de saída / visitas — **nunca** de `ultima_acao_at`.
- Funções `public.lead_saude*` (faixa por etapa, BRT) + RPC `rpc_carteira_saude(escopo, user)` **role-scoped** (SECURITY DEFINER + `has_role`/`team_members`). Espelho TS `src/lib/leadSaude.ts`.
- **Painel-sombra** (rota admin escondida): por corretor, saúde-por-tarefa × saúde-por-toque + % de leads sem `ultimo_toque_at`.
- **Não tocar:** `trg_update_lead_ultima_acao`, cadência, playbook, RLS de `pipeline_tarefas`.
- **Gate:** a Fase 1 só começa quando o painel-sombra confirmar a cobertura do backfill.
- **Invisível pro corretor.** Risco: backfill subestimar toques antigos → mitigado pela semana de sombra.

### Fase 1 — ⚡ central + saúde por toque + agenda · 1 migration
- **⚡ Registrar atividade** vira modal único (`tipo_contato` + `resultado`), reaproveitando `QuickActionMenu.tsx`/`FocusModeModal`; ao final, oferta pulável de lembrete (5 opções, incl. data personalizada).
- **Conclusão de lembrete com prompt [⚡ Registrar]/[Só concluir]** — caminho separado que **não** insere atividade, não chama `registrarToque`, não escreve `ultima_acao_at` (antecipa parte da limpeza da Fase 2; é condição do invariante). Arquivos: `completeLeadTask.ts`, `taskCompletion.ts`, `TaskCompletionDialog.tsx`, `TarefasHojeLateral.tsx`, `MinhasTarefas.tsx`, `CardMinimal.tsx`.
- **Cor por toque:** `CardMinimal.tsx`, `PipelineAdvancedFilters.tsx`, `PipelineFiltroBadges.tsx` passam a usar `leadSaude.ts`. Etapas terminais sem cor.
- **Agenda do corretor** (4 fontes, só leitura; lembrete vencido como atrasado).
- **Migration 2:** cron + edge `lembrete-notify` (varre `vence_em`+`hora_vencimento` em BRT → `criar_notificacao`).
- **Botão .ics** nas visitas (client-side, `src/lib/icsVisita.ts` + `VisitaRow.tsx`/`VisitaConfirmacao.tsx`).
- **Risco:** a virada de cor é visível ao time — publicar junto do aviso/onboarding.

### Fase 2 — Tarefa vira lembrete, Sem Contato re-surge, playbook aposentado · 2 migrations (dias separados)
- Tarefas manuais existentes migram para `tipo='lembrete'`; `completeLeadTask.ts`/`taskCompletion.ts` param de gravar toque no caminho lembrete (o caminho ⚡ continua inserindo).
- **Migration 3 — cadência com auto-lembretes, avanço por atividade:** os 7 passos viram `tipo='lembrete'` + `origem='cadencia_sem_contato'` (inertes); `fn_cadencia_sc_recalcular_por_tarefas` deixa de contar tarefas concluídas; `fn_cadencia_sc_avancar_acao` avança `tentativa_atual` por atividade; concluir/dispensar o auto-lembrete não avança nem conta toque; em T7 → `aguardando_descarte`. **Dropar `trg_cadencia_sc_recalcular_tarefas`** (senão duplica o auto-lembrete); recálculo passa a ter só 2 gatilhos: entrada na etapa e nova atividade.
- **Migration 4 — estagnação unificada:** `_pipeline_referencia_estagnacao` usa o relógio de toque; remove a "proteção por tarefa futura"; `pipeline_estagnacao_config` ativa só em Sem Contato, Qualificação (21d) e Aquecimento (21d). Drop da função órfã de playbook + remover UI de playbook.
- **Risco:** mexe em fluxo de 7 passos em produção — validar em lead de teste no preview.

### Fase 3 — Consolidar KPIs e comunicar
- `taskBuckets.ts`/`useCorretorKpisCarteira.ts`/`CarteiraKpis.tsx`/`CaminhosCards.tsx` + Corretor/Gerente/CEO dashboards passam a consumir `rpc_carteira_saude`: **% da carteira em dia** e **atualizados hoje (BRT)** substituem "sem tarefa".
- Onboarding "O CRM mudou": novo step em `useOnboarding.ts` + `OnboardingWidget.tsx` (infra `corretor_onboarding` já existe).
- Limpeza: aposentar escritas redundantes de `ultima_acao_at`; avaliar restringir `trg_update_lead_ultima_acao`.

---

## 7. Migração dos dados existentes
- Tarefas manuais abertas → `tipo='lembrete'` (mantém título e data). Nada se perde.
- Tarefas de sistema (Sem Contato) → viram auto-lembretes da cadência; pendentes absorvidas.
- **Manter `pipeline_tarefas`** (reaproveitar, não dropar).

---

## 8. Guardrails e o que NÃO tocar
- **Máx 2 migrations/dia, 08–19h BRT.** BRT em toda lógica temporal (`@/lib/brtTime`). 1 mudança por rodada. Verificar no preview antes de publicar.
- **Fase 1 gated pelo painel-sombra da Fase 0.**
- **Não tocar:** RLS duplicada de `pipeline_tarefas` · VGV/`v_fato_venda`/`v_pdn_linhas`/Vendas Realizadas · Roleta/Oferta Ativa · `team_members` (fonte única de hierarquia) · papéis reais `admin/diretor/gestor/corretor/backoffice/rh` (não existe `ceo` — CEO = admin) · Google Calendar OAuth (parqueado).

---

## 9. Onboarding "O CRM mudou" (segunda)
7 telas no 1º login: (1) o CRM mudou e ficou mais simples · (2) a cor é o seu toque real · (3) o ⚡ + oferta de retorno · (4) tarefa virou lembrete (post-it, não muda a cor) · (5) meta = % em dia · (6) a agenda é seu painel · (7) o que continua igual. Banner de reforço por 7 dias + versão do gestor. **Só liberar com a Fase 1 publicada e verificada**, e com a cobrança do gestor mudando para % em dia no mesmo dia.

---

## 10. Régua de cadência (parqueada)
Não entra agora. Volta só com **sugestão inteligente de verdade** (situação do lead + imóvel, via LIA/HOMI), no modelo **copiloto** (sugere na agenda, nunca envia sozinho). Fica atrás do teste da LIA.

---

## 11. Impacto esperado em conversão
Não cria demanda — **para de deixar vazar o lead já pago.** Vazamentos de hoje: 1º contato ~15,5h · Aquecimento→Visita ~13% (leads ~15d sem toque) · pós-visita ~28d abandonado.
Cenários (base ilustrativa 12 vendas/mês, ticket ~R$330k — calibrar no real):
- **Conservador +8%** → ~+1 venda/mês → ~+R$3,8 mi/ano
- **Esperado +20%** → ~+2,4 vendas/mês → ~+R$9,5 mi/ano
- **Otimista +35%** → ~+4 vendas/mês → ~+R$16,6 mi/ano

**Indicadores que provam em 2-3 semanas** (antes da venda mexer): tempo até 1º contato (15,5h → <4h) · leads frios 14+ dias (43% → <20%) · taxa Aquecimento→Visita ↑ · atividades ⚡/corretor/dia ↑. O painel-sombra já mede isso.

---

## 12. Runbook de execução (domingo → segunda)
1. **Fase 0 (Migration 1)** — instrumentação + painel-sombra.
2. **GATE:** conferir cobertura do backfill no painel-sombra. Boa → segue; ruim → segura a virada e o onboarding.
3. **Fase 1 (Migration 2)** — ⚡, cor por toque, agenda, conclusão de lembrete, notificação, .ics. (2 migrations = teto do dia.)
4. **Verificar no preview:** concluir lembrete não pinta; ⚡ pinta; % em dia bate nos 3 níveis; terminais sem cor. Publicar.
5. **Segunda:** onboarding (se Fase 1 publicada) + cobrança do gestor vira % em dia.
6. **Dias seguintes:** Fase 2 (Migrations 3 e 4, dias separados) e Fase 3.

**Loop sempre:** plano → aprova → build escopo estrito → preview → publica.

---

## 13. Documentos-fonte (Projeto)
Plano Definitivo Lovable · Ajustes Verificados (Lembrete↔Atividade + Cadência) · Decisões Finais (Saúde por Toque) · Verificação Ponta a Ponta · Notificações + Agenda do Celular · Runbook de Domingo. Mockups: Fluxo Ponta a Ponta · Definição da Tarefa · Confirmação das 5 decisões · Cockpit em Cascata · Onboarding · Simulação de Conversão · Um Dia do Corretor.

---

*Fechado em 08/08/2026. Pronto para execução na Fase 0.*
