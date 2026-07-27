## Diagnóstico confirmado

**Como os 22 leads chegaram em Pós-Visita sem row em `visitas`:**
Todos entraram no dia 27/07, sem registro em `pipeline_historico` → foram movidos pela migration de introdução do stage `pos_visita` (backfill que usou `flag_status.status_visita='realizada'` como critério). O fluxo antigo permitia marcar a flag "realizada" na etapa Visita sem criar registro na agenda.

**Discrepância PDN 124 vs Kanban 50:**
`usePdn.ts` mistura duas fontes: (a) 50 pipeline_leads em stage `pos_visita` e (b) 128 visitas realizadas do mês sem negócio ativo. Dessas 128, apenas 19 estão em `pos_visita` — as outras 109 já saíram da etapa (Qualif=14, Aquec=44, Visita=13, Negociação=32, Contrato=4, Ganho=16, Descarte=13) e aparecem erradas no PDN.

**Tarefas etapa Visita:**
O trigger `trg_visita_stage_entry_fn` só cria tarefa quando **não existe** visita agendada. Como a maioria entra em Visita com agenda pronta, o corretor não recebe tarefa e se perde.

---

## Regras acordadas

1. Toda visita realizada → move lead para stage `pos_visita` (fonte única).
2. PDN grupo Pós-Visita = APENAS pipeline_leads em stage `pos_visita`.
3. Tarefas automáticas mantidas + botão "Criar tarefa" com liberdade total.
4. Sub-status Visita: `marcada · confirmada · realizada · no_show · reagendada`.
5. **Novo:** painel de conferência "Visitas do mês fora de Pós-Visita" para o gestor, separado do PDN.

---

## Fase A — Backend (migration única)

**A1. Backfill dos 22 órfãos** — cria row retroativa em `visitas` (status='realizada', data=stage_changed_at, origem='backfill_pos_visita', observação explicativa). Corrige o 1 lead com `status_visita='pos_visita'` para `realizada`.

**A2. Trigger `trg_visita_status_realizada_move_stage`** (em `public.visitas`): quando `status` vira `realizada`, se lead está em stage anterior a `pos_visita`, move para `pos_visita`. Blindagem contra qualquer origem (UI, cron, edge, manual).

**A3. Trigger `trg_pipeline_lead_pos_visita_garantir_visita`** (BEFORE UPDATE em `pipeline_leads`): se novo stage é `pos_visita` e não há visita realizada, cria retroativa em vez de bloquear. Garante invariante "todo lead em Pós-Visita tem visita realizada".

**A4. `trg_visita_stage_entry_fn`** — reescrever para criar sempre (dedup por `subtipo`):
- `confirmar_visita` (data_visita − 1 dia, 10h) — se há visita `marcada`
- `realizar_visita` (data_visita, hora_visita) — se `marcada`/`confirmada`
- `registrar_resultado` (data_visita + 1 dia, 10h) — se ainda não `realizada`
- Fallback `atualizar_visita` (48h) — só quando não há visita nenhuma

Todas `origem='visita_auto'` (editáveis/canceláveis pelo corretor).

**A5. Trigger `trg_visita_sync_flag_status`** — quando muda `visitas.status`, atualiza `pipeline_leads.flag_status.status_visita`. Aceita novo valor `confirmada`.

---

## Fase B — Frontend

**B1. `src/hooks/usePdn.ts`** — remover fonte `visitasReal` das linhas do grupo Pós-Visita. Só conta pipeline_leads em stage `pos_visita`.

**B2. `src/lib/leadHelpers.ts`** — add `confirmada` em `VISITA_SUBSTATUS` + badge (label "✅ Confirmada", emerald claro).

**B3. `src/hooks/useVisitas.ts`** — remover auto-move manual em `updateStatus('realizada')` (trigger A2 assume).

**B4. `src/lib/visitaResultadoRouting.ts`** — validar caminho "Confirmada" (grava status, sem mover stage).

**B5. `PipelineLeadDetail.tsx`** — CTA "➕ Criar tarefa" sempre visível em Visita/Pós-Visita.

**B6. Popup de transição Visita** — add opção "Confirmada".

---

## Fase C — Novo painel de conferência "Visitas do Mês" (gestor)

**C1. Nova aba na PDN (não substitui nada):** ao lado das abas atuais do gestor em `/pdn`, adicionar aba **"📋 Conferência de Visitas"** — separada do PDN operacional.

**C2. Conteúdo:** tabela listando **todas as visitas realizadas no mês corrente (BRT)**, com colunas:
- Data visita · Lead · Corretor · Empreendimento visitado · Stage atual do lead · Sub-status · "Tem negócio?" · Ação (abrir lead)

**C3. Agrupamento visual por stage atual do lead:**
- ✅ Em Pós-Visita (esperado) — verde
- ⚠️ Em Negociação/Contrato/Ganho (avançou, ok) — azul
- 🔴 Em Qualificação/Aquecimento/Visita (regrediu — gestor precisa checar) — vermelho
- ⚫ Em Descarte (perdemos) — cinza

**C4. KPI header:** total do mês · % em Pós-Visita · % avançaram · % regrediram · % descartadas.

**C5. Filtros:** por corretor, por empreendimento, por stage atual. Export CSV.

**C6. Arquivos novos (não mexe em componentes existentes):**
- `src/components/pdn/ConferenciaVisitasMes.tsx` (componente da nova aba)
- `src/hooks/useConferenciaVisitas.ts` (query dedicada, escopo mês BRT)
- Adicionar aba em `PdnGestor.tsx` (única mudança em arquivo existente da fase C)

Query: `SELECT v.*, pl.stage_id, ps.tipo, ps.nome ... FROM visitas v JOIN pipeline_leads pl ON pl.id=v.pipeline_lead_id JOIN pipeline_stages ps ON ps.id=pl.stage_id WHERE v.status='realizada' AND v.data_visita BETWEEN <mês BRT>`.

Escopo por role: corretor vê só as suas, gestor vê da equipe (via team_members), CEO/diretor vê tudo.

---

## Fase D — Validação end-to-end

Preview com lead de teste (sempre cancelar):
1. Lead → Visita → agendar amanhã → 3 tarefas criadas (confirmar/realizar/registrar). ✅
2. Marcar `confirmada` → sub-status muda, tarefa "confirmar" some. ✅
3. Marcar `realizada` → lead auto-move para Pós-Visita, tarefa 48h aparece. ✅
4. Contagem Kanban Pós-Visita = PDN Pós-Visita. ✅
5. Descartar em Pós-Visita → sai do grupo PDN imediatamente. ✅
6. SQL: 22 órfãos agora têm visita registrada. ✅
7. SQL: nenhum lead com visita realizada do mês em Qualif/Aquec/Visita/Descarte sem justificativa. ✅
8. Aba "Conferência de Visitas" abre com número = total real de visitas realizadas do mês, agrupamento correto. ✅

---

## Arquivos tocados

**Migration única:** backfill 22 + 3 triggers novos + 1 alterado.

**Frontend:**
- `src/hooks/usePdn.ts` (remover fonte visitasReal)
- `src/hooks/useVisitas.ts` (limpar auto-move)
- `src/lib/leadHelpers.ts` (add confirmada)
- `src/lib/visitaResultadoRouting.ts` (revisão leve)
- `src/components/pipeline/PipelineLeadDetail.tsx` (CTA criar tarefa)
- Popup transição Visita
- `src/pages/PdnGestor.tsx` (adicionar aba conferência)
- **NOVOS:** `src/components/pdn/ConferenciaVisitasMes.tsx`, `src/hooks/useConferenciaVisitas.ts`

Zero mudança em rota, zero mudança em dados de negócio fechados, zero impacto em Roleta / WhatsApp / HOMI.

---

## Riscos & mitigação

- **Trigger A2 em loop:** protegido por check de stage atual (só move se anterior a pos_visita).
- **PDN esvaziar visualmente para gestor:** compensado pela nova aba "Conferência de Visitas" — nada se perde, só fica no lugar certo.
- **Backfill retroativo:** data = stage_changed_at, não conta como visita nova nos KPIs.
- **Aba de conferência é READ-ONLY:** nenhum botão de mover/editar lead; só link para abrir detalhe. Não risca operação.

Aguardo aprovação para rodar a migration e implementar.