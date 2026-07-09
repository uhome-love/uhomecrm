## Objetivo
(A) Garantir pausa TOTAL de disparos; (B) corrigir as 3 situações auditadas — pipeline do Misael/estagnados, regra de estagnação após mudança de etapas, e os 13 leads "Ganho" poluindo a Roleta.

---

## PARTE A — Parar todos os disparos (reengajamento/nurturing)

### Diagnóstico
- Automático já OFF (crons inativos; `reengajamento_config.enabled=false`; `nurturing_cadencias` 0 ativas).
- Disparo de hoje foi **manual** (`connectjw_julho`, 638 envios), permitido porque `system_flags.campaign_dispatch_enabled=true`.
- Risco residual: **1.443 itens `pending`** em `reengajamento_dispatch_queue`.

### Correções (dados)
1. `system_flags.campaign_dispatch_enabled` → **false**.
2. `reengajamento_dispatch_queue`: 1.443 `pending` → `cancelled`.
3. Runs `paused`/`timeout` → `cancelled` + `cancel_requested=true`.
4. `reengajamento_config.paused_until_release=true` (trava botão da Central).

---

## PARTE B — Auditoria e correções

### B1. Migração de etapas 08/07 — CAUSA RAIZ (confirmada)
- Em 08/07 uma migração moveu **851 leads ativos para "Qualificação"** (SQL direto, sem `pipeline_historico`), atingindo ~29 corretores. Vinham de etapas legadas (Busca, Contato Iniciado etc.).
- Isso encheu os boards de todos os corretores (ex.: Misael 18 → 106) com leads que já estavam parados.
- **Problema técnico:** `_pipeline_ultima_acao_humana` considera `stage_changed_at` como atividade; a migração carimbou 08/07 em todos → o cron de estagnação NUNCA re-sinalizaria esses leads. Precisa de backfill manual.

### B2. Regra de estagnação — realinhar ao board novo
Ajustar `pipeline_estagnacao_config`:
- **Qualificação = 15 dias** (nova regra).
- **Aquecimento = 30 dias** (mantém).
- **Desativar** regras legadas `Contato Iniciado` e `Busca`.
- **Visita, Em Negociação, Contrato e demais = SEM estagnação** (da visita em diante não estagna).
- "Sem Contato" continua na cadência dedicada (não duplicar).

### B3. Backfill dos estagnados da migração
Marcar como `estagnado=true` os leads em Qualificação, ativos, movidos em 08/07, cuja **última ação humana real** (GREATEST de created_at, aceito_em, atividades, anotações, tarefas concluídas, WhatsApp enviado, visitas — **excluindo** o `stage_changed_at` da migração) seja > 15 dias.
- Escopo medido: **168 leads** de **22 corretores** → vão para a Central de Leads Estagnados; os 683 com atividade recente permanecem ativos.
- Distribuição: Luiza Clós 22, Paula Medeiros 21, Gustavo Niz 17, Jéssica França 15, Flávio Dias 13, **Misael 12**, Junior Padilha 9, Anderson 9, Douglas 7, Ebert 6, Gabriel 6, Andressa 5, William Brizola 4, Guilherme 4, Thalia de Oliveira 4, Adriana 4, Rafaela Sandin 3, Matheus Pasin 3, e outros 1 cada (Halime, Cássio, Wendel, Leo).
- Setar `estagnado_em` = última ação real (para histórico correto) e registrar observação "Estagnado (backfill migração de etapas 08/07)".

### B4. Painel da Roleta — excluir Ganho da contagem
Ajustar a consulta do painel "Leads Gerados (Mkt)" / origem para **excluir leads em etapa Ganho** (e sem origem de marketing). Resolve os 13 "Sem empreendimento / Desconhecido" (vendas fechadas importadas hoje 18:10) sem alterar os dados das vendas.

---

## Validação final
- A: kill switch off, fila 0 `pending`, runs sem paused/timeout.
- B2: `pipeline_estagnacao_config` só com Qualificação(15d)+Aquecimento(30d).
- B3: 168 leads em Estagnados; boards limpos; Misael com carteira ativa real (sem os 12 parados).
- B4: Roleta deixa de contar os Ganhos importados.

## Observação
Após o backfill, o cron passa a operar corretamente na Qualificação (15d) para os leads que ficarem parados daqui pra frente.
