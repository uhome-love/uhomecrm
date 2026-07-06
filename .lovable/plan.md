## Objetivo

Deixar como padrão **nenhum disparo de WhatsApp sendo feito automaticamente** pelo CRM (reengajamento de descartados + lembrete de visita amanhã). O disparo **manual** pela Central de Reengajamento continua funcionando normalmente.

## Situação atual

Existem dois crons ativos que disparam WhatsApp sozinhos:

| Cron | Frequência | O que faz |
|------|-----------|-----------|
| `reengajamento-descartados-diario` | Diário ~10h BRT | Dispara reengajamento para leads descartados |
| `visita-reminder-daily-09h` | Diário ~09h BRT | Dispara lembrete "visita amanhã" |

Observação: a flag `reengajamento_config.enabled` já está `false`, mas o cron continua ligado — o desligamento do cron torna o comportamento definitivo e independente da flag.

## Mudanças

1. **Desativar o cron `reengajamento-descartados-diario`** — para de acionar o disparo diário de reengajamento.
2. **Desativar o cron `visita-reminder-daily-09h`** — para de acionar o lembrete automático de visita amanhã.
3. **Manter `reengajamento_config.enabled = false`** como salvaguarda extra.

Nada é apagado — os crons ficam apenas inativos e podem ser reativados quando o usuário quiser voltar com o automático.

## O que continua funcionando

- Disparo **manual** pela Central de Reengajamento (aba "Novo disparo" e campanhas em ondas).
- Recebimento de leads (Meta/site) e distribuição — não são afetados.
- Limpezas e relatórios automáticos — não são afetados.

## Detalhes técnicos

- Usar `cron.unschedule`/`UPDATE cron.job SET active=false` nos jobs `reengajamento-descartados-diario` (jobid 42) e `visita-reminder-daily-09h` (jobid 6) via a ferramenta de dados (contêm URL/anon key específicos do projeto, portanto não vão em migration).
- Garantir `reengajamento_config.enabled=false`.
- Verificar após a mudança consultando `cron.job` para confirmar que ambos ficaram `active=false`.
