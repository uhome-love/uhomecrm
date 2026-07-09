# Pausar todos os nurturings e disparos automáticos do CRM

## Objetivo
Nenhuma mensagem automática (WhatsApp/e-mail) de nurturing/reengajamento/sequência deve ser disparada pelo CRM. Disparos **manuais** (Central de Disparos, feitos pelo usuário) continuam existindo, mas nada roda sozinho.

## Estado atual levantado
Crons de nurturing **já inativos**: `cron-smart-nurturing-daily`, `nurturing-sequencer-15min`, `nurturing-sequencer-every-30min`, `reactivate-cold-leads-weekly`, `reengajamento-descartados-diario`, `visita-amanha-auto-2min`, `visita-reminder-daily-09h`.

Ainda ligados / com dados ativos:
- Cron `execute-sequences-every-5min` (ativo) — motor de sequências de nurturing.
- `nurturing_cadencias`: **10 cadências ativas**.
- `lead_nurturing_state`: **234 leads com status `active`** (inscritos em nurturing).
- `automations`: 0 ativas · `pipeline_sequencias`: 0 ativas · `reengajamento_config`: 0 habilitada (já desligados).

## Ações

### 1. Desligar os crons que disparam mensagens automáticas
- Desativar `execute-sequences-every-5min` (motor de nurturing/sequências).
- Garantir que permaneçam desativados os crons de nurturing/reengajamento/visita já listados acima.
- **Mantidos ligados** (não são disparo de nurturing): roleta, limpezas, relatórios, escalação, sync de catálogo, health checks. `mailgun-batch-send` é o entregador de campanhas de e-mail disparadas manualmente — será mantido, pois só envia o que o usuário enfileira; se preferir, também desligamos.

### 2. Pausar as cadências de nurturing (dados)
- `nurturing_cadencias`: marcar as 10 como `is_active = false`.
- `lead_nurturing_state`: mudar os 234 registros `active` para pausado (status `paused`), preservando o histórico para reativar depois se quiser.

### 3. Confirmar reengajamento desligado
- `reengajamento_config` já está `enabled = false` — apenas confirmar.

## Validação final
- `SELECT` confirma: `execute-sequences-every-5min` inativo; nenhum cron de nurturing/reengajamento ativo.
- `nurturing_cadencias` com 0 ativas; `lead_nurturing_state` com 0 `active`.
- Nenhum disparo automático parte do CRM; apenas disparos manuais permanecem sob controle do usuário.

## Observação (fora do escopo do pause)
A venda/pergunta do print: a lead **Josiane Corrêa Barcella** respondeu ao disparo do empreendimento **Connect JW** (template `connectjw_julho`). Já informado ao usuário para repassar ao corretor.
