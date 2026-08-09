# Nova Gestão Comercial + Fricção-zero — Plano de execução

> Data: 2026-08-09 · Branch: `feat/nova-gestao` · Estratégia: **local-first** (constrói na cópia interna, testa, publica só quando verde).

## 1. Objetivo

Trocar a base do CRM de **"tarefa obrigatória"** para **"atividade real"**:
- A **saúde do lead** passa a refletir o **último toque real** (`ultimo_toque_at`), não a existência de tarefa aberta.
- **Mover é instantâneo**; **registrar atividade + agendar próximo passo** é rápido e opcional (o popup que o Lucas propôs).
- Menos trabalho pro corretor, dado verdadeiro pra gestão, lead pago não vaza.

## 2. Regra de ouro (invariante)

> **Lembrete = post-it na agenda.** Não conta como toque, não muda a cor.
> Só o **⚡ Registrar atividade** (contato real) carimba `ultimo_toque_at` e a saúde.

O que conta como toque: ligação · WhatsApp do corretor · e-mail · visita agendada · visita realizada · ⚡ atividade.
O que NÃO conta: anotação · HOMI/automático/campanha · criar/concluir lembrete · mudar de etapa.

## 3. Como construímos com segurança (local-first)

- **Frontend** → tudo na branch `feat/nova-gestao`, testado em `localhost` (contra o banco de prod, que é o mesmo). **Não vai pro ar** até `git push main`.
- **Migrations invisíveis (Fase 0)** → aditivas; carimbam uma coluna que hoje ninguém lê (`ultimo_toque_at`) e criam RPCs/funções novas. **Podem ir pra prod agora sem o time perceber** (nada muda até o frontend novo subir).
- **Migrations que mudam comportamento (Fase 2)** → cadência/estagnação: **só depois de validar** no painel-sombra + lead de teste.
- **Regra:** publica o frontend (push main) só quando cada peça estiver verde localmente. A virada de cor/agenda sai junto de um aviso de onboarding.

## 4. Viabilidade (honesto)

- A Nova Gestão **completa e bem-feita não cabe numa noite** (⚡ modal unificado, agenda nova, cor-por-toque em 3+ componentes, cadência, KPIs, onboarding). É trabalho de alguns dias.
- **Mas** o local-first tira o risco: construímos e testamos sem tocar no time. O que entra primeiro (alto valor, seguro):
  - **Fase 0** (migration invisível) — hoje.
  - **Fase 1 core** (fricção-zero no mover + ⚡ registrar atividade + agendar + cor por toque) — construir na branch, testar, publicar quando verde.
- O resto (cadência re-surgida, playbook aposentado, KPIs "% em dia", onboarding) vem faseado nas próximas rodadas.

## 5. Prazos de "em dia" por etapa (dias sem toque)

| Etapa | Em dia até | Estagnação |
|---|---|---|
| Novo Lead | 1 dia | não estagna |
| Sem Contato | 2 dias | pela cadência (7 tentativas → aguardando descarte) |
| Qualificação | 7 dias | 21 dias sem toque |
| Aquecimento | 15 dias | 21 dias sem toque |
| Visita | 2 dias | não estagna |
| Em Negociação | 7 dias | não estagna |
| Contrato | 7 dias | não estagna |

Cores: dentro do prazo = verde · até 2× = âmbar · acima = vermelho.
Relógio: `COALESCE(ultimo_toque_at, distribuido_em, stage_changed_at, created_at)`.
Terminais (Ganho/Caiu/Descarte/arquivado): sem cor, fora do denominador.

## 6. Fases (com a fricção dentro da Fase 1)

### Fase 0 — Instrumentação invisível · 1 migration · HOJE
- Trigger `AFTER INSERT ON pipeline_atividades` → carimba `ultimo_toque_at` (só contato humano, não HOMI/automático).
- Trigger `AFTER INSERT ON visitas` → carimba `ultimo_toque_at` (visita agendada = toque).
- **Backfill** único de `ultimo_toque_at` a partir de atividades / WhatsApp de saída / visitas — **nunca** de `ultima_acao_at`.
- Funções `public.lead_saude*` (faixa por etapa, BRT) + `rpc_carteira_saude(escopo, user)` role-scoped.
- Espelho TS `src/lib/leadSaude.ts`.
- **Painel-sombra** (rota admin escondida): saúde-por-tarefa × saúde-por-toque + % de leads sem `ultimo_toque_at`.
- Não tocar: `trg_update_lead_ultima_acao`, cadência, playbook, RLS de `pipeline_tarefas`.
- **Gate:** Fase 1 só publica quando o painel-sombra confirmar a cobertura do backfill.

### Fase 1 — ⚡ central + saúde por toque + agenda + FRICÇÃO-ZERO · frontend + 1 migration (cron)
- **Fricção-zero no mover:** `needsTransitionPopup` deixa de forçar formulário nas etapas de processo (sem contato, contato inicial, qualificação, aquecimento, possível visita, pós-visita, proposta, documentação, contrato). Mover = instantâneo. Críticas mantêm o essencial: **Venda** (VGV/data/unidade), **Caiu/Descarte** (motivo), **Visita** (agendamento).
- **⚡ Registrar atividade** = modal único (`tipo_contato` + `resultado`), reaproveitando `QuickActionMenu`/`FocusModeModal`; grava `pipeline_atividades`. Ao final, **oferta pulável de agendar próximo passo** (Amanhã · 2 dias · Semana · Data · Agora não) → cria lembrete (`pipeline_tarefas` tipo='lembrete').
- **Popup pós-move** (leve, pulável): oferece ⚡ registrar + agendar. Não trava.
- **Cor por toque:** `CardMinimal.tsx`, `PipelineAdvancedFilters.tsx`, `PipelineFiltroBadges.tsx` passam a usar `leadSaude.ts`. Terminais sem cor.
- **Agenda do corretor** (4 fontes, só leitura; lembrete vencido aparece como atrasado).
- **Migration (cron):** edge `lembrete-notify` varre `vence_em`+`hora` em BRT → `criar_notificacao` (push já existe).
- **Botão .ics** nas visitas (`src/lib/icsVisita.ts`).
- Risco: virada de cor é visível → publicar junto de onboarding.

### Fase 2 — Tarefa vira lembrete + cadência re-surge + playbook aposentado · 2 migrations (dias separados)
- Tarefas manuais → `tipo='lembrete'`; caminho lembrete para de gravar toque (⚡ continua).
- Migration cadência: 7 passos viram auto-lembretes; avanço por **atividade**, não por concluir tarefa; T7 → `aguardando_descarte`. Dropar `trg_cadencia_sc_recalcular_tarefas`.
- Migration estagnação: relógio de toque; remover "proteção por tarefa futura"; ativa só em Sem Contato/Qualificação(21d)/Aquecimento(21d). Aposentar playbook.
- Risco: mexe em fluxo de 7 passos em prod → validar em lead de teste.

### Fase 3 — KPIs "% da carteira em dia" + onboarding
- `taskBuckets.ts`/`useCorretorKpisCarteira.ts`/dashboards passam a consumir `rpc_carteira_saude`.
- Onboarding "O CRM mudou" (`useOnboarding.ts` + `OnboardingWidget.tsx`).
- Limpeza: aposentar escritas redundantes de `ultima_acao_at`.

## 7. Guardrails (não se quebra)

- Máx **2 migrations/dia, 08–19h BRT**. BRT em toda lógica temporal (`@/lib/brtTime`). 1 mudança por rodada.
- Verificar no preview/local antes de publicar. Fase 1 gated pelo painel-sombra.
- Não tocar: roleta, VGV/RLS remediada, `team_members`, LIA.
- Migração de dados preserva tudo: tarefas abertas viram lembrete (mantém título/data); `pipeline_tarefas` NÃO é dropada.

## 8. Ordem de ataque (local-first)

1. **Hoje:** Fase 0 (migration invisível em prod) + começar Fase 1 core na branch.
2. Construir Fase 1 core (fricção-zero + ⚡ + agendar + cor por toque) na branch, testar local.
3. Painel-sombra confirma backfill → publicar Fase 1 com onboarding.
4. Fases 2 e 3 nas rodadas seguintes.
