# Finalizar correções de segurança (manter todas as alterações)

Decisão do usuário: **manter as alterações mesmo sem cadastrar segredos**. Ciente de que, sem `CRON_SECRET`, as crons retornarão 401, e sem `INTERMEDIACAO_*`, o `gerar-intermediacao` falhará até os segredos existirem.

## Mantido (já aplicado)
- **Banco (migration concluída):** `melnick_campaign_analytics` (insert admin/gestor), `tarefas` (`has_role`), `voice_campaigns` (leitura admin/gestor/criador), storage `homi-documents` (upload admin/gestor).
- **Mapbox:** lê `VITE_MAPBOX_TOKEN` com fallback.
- **`typesense-search`:** whitelist de campos + cap de `per_page`.
- **Crons:** `requireCronAuth` em `nurturing-orchestrator`, `cron-nurturing-sequencer`, `sweep-descartados`, `auto-one-on-one`, `stalled-deals-notify` + helper `_shared/cron-auth.ts`.
- **`gerar-intermediacao`:** PII carregada via `Deno.env` (`INTERMEDIACAO_LUCAS_JSON`, `INTERMEDIACAO_GABRIELLE_JSON`).

## Passos finais
1. **Deployar** as edge functions alteradas: `typesense-search`, `nurturing-orchestrator`, `cron-nurturing-sequencer`, `sweep-descartados`, `auto-one-on-one`, `stalled-deals-notify`, `gerar-intermediacao`.
2. **Marcar como corrigidos** no scanner os findings resolvidos: análises de campanha, tarefas, voice_campaigns, storage homi-documents, mapbox, typesense, crons e PII.

## Aviso
Para cron e PII funcionarem em produção, ainda é preciso cadastrar os segredos depois (`CRON_SECRET` + atualização dos agendamentos; `INTERMEDIACAO_LUCAS_JSON` / `INTERMEDIACAO_GABRIELLE_JSON`). Quando quiser, eu gero o `CRON_SECRET` e entrego o JSON da PII prontos para colar.
