# Central de Reengajamento — 100% manual, alta entrega

Objetivo: nada dispara sozinho. Você abre a página, escolhe base + template (ou ativa uma cadência de nutrição), dispara, e acompanha ao vivo o que está sendo feito e o resultado. Visita Amanhã sai por completo. Automático fica bloqueado na fonte.

## Como fica a página `/central-relatorios` (Central de Reengajamento)

Uma página com abas:

```
┌─────────────────────────────────────────────────────────┐
│  Central de Reengajamento                                 │
│  [ Disparo manual ] [ Nutrição ] [ Ao vivo ] [ Config ]  │
└─────────────────────────────────────────────────────────┘
```

1. **Disparo manual** — o card atual (base: Descartados / Oferta Ativa / Pipeline por etapa; template Meta com imagem de header; dedup por telefone; preview → disparar). Alta entrega via Meta (template oficial + supressão + throttle já existentes).
2. **Nutrição** (nova) — chave mestra Liga/Desliga + escolher qual cadência ativar e para qual base, disparo manual do fluxo. Enquanto desligada, o sequenciador não envia nada.
3. **Ao vivo** — o que está rodando agora (run ativo, fila, enviados/entregues/lidos/respostas em tempo real) + resultado consolidado. Junta o `LiveDispatchBanner` + `AuditoriaWebhookTab` + respostas recebidas.
4. **Config** — instância WhatsApp, templates, janelas/throttle. Sem nenhum controle de automação (motor automático removido).

## O que muda

### 1. Remover Visita Amanhã (completo)
- Excluir `VisitaAmanhaTab.tsx` e a fonte `visita_amanha` de `DisparoCustomizadoCard.tsx` (botão, filtros, branch de disparo, defaults de config).
- Remover o card "Histórico legado — Visita Amanhã" de `CentralNutricao.tsx`.
- Apagar a edge function `visita-amanha-enqueue` e sua entrada no `config.toml`.
- Desagendar/remover qualquer cron de visita-amanhã.

### 2. Bloqueio total de automático (na fonte)
- Manter `system_flags.campaign_dispatch_enabled = false` como kill-switch de **crons** (já está false).
- **Remover os gatilhos por evento**: as três chamadas a `nurturing-orchestrator` em `whatsapp-webhook`, `vitrine-public` e `elevenlabs-webhook` deixam de agendar/enviar. Elas passam a só registrar evento/scoring, sem criar sequência de envio automático (nada sai sozinho).
- Confirmar todos os crons de nutrição/reengajamento/visita **inativos** em `cron.job`.

### 3. Nutrição acionável por você (nova tela + gate próprio)
- Nova flag `system_flags.nutricao_enabled` (default `false`), controlada pela **chave mestra** da aba Nutrição.
- `cron-nurturing-sequencer` passa a exigir `nutricao_enabled = true` (além do gate global). Como não há cron ativo chamando ele, o processamento do fluxo é disparado manualmente pelo botão "Processar agora" da tela quando você liga a chave.
- Escolha da cadência: listar `nurturing_cadencias` ativas por `stage_tipo`; você seleciona o fluxo e a base, e enfileira as sequências (`lead_nurturing_sequences`) só nesse momento.
- Recomendação de UX: banner "Nutrição LIGADA" persistente enquanto ativa, com 1 clique para desligar ao terminar.

### 4. Disparo manual continua funcionando mesmo com kill-switch global
- Hoje `reengajamento-descartados-enqueue` também checa `campaign_dispatch_enabled`, o que bloquearia até o disparo manual.
- Ajuste: o gate distingue **chamada de cron** (bloqueada) de **chamada manual autenticada** (`iniciado_por: "manual_custom"` + JWT de usuário) → o disparo manual explícito passa; qualquer chamada sem usuário/por cron continua bloqueada. Mantém todas as travas de qualidade (blacklist de template, `paused_until_release`, auto-pausa por qualidade Meta).

## Validação (end-to-end)
1. `tsgo` + build limpos após remoções.
2. Playwright no preview: abrir a página, checar as 4 abas, ausência total de Visita Amanhã.
3. Preview de audiência real em cada base (Descartados/Oferta Ativa/Pipeline) retornando contagem.
4. Disparo manual real de 1 lead de teste via Meta → confirmar entrega e aparecimento na aba "Ao vivo".
5. Nutrição: ligar chave → "Processar agora" com 1 lead → confirmar envio; desligar → confirmar que nada mais sai.
6. Confirmar via consulta que nenhum cron automático de nutrição/reengajamento/visita está ativo e que os webhooks não criam sequências.

## Detalhes técnicos
- Frontend: renomear/reestruturar `CentralNutricao.tsx` para as 4 abas; nova `NutricaoTab.tsx`; consolidar "Ao vivo" (LiveDispatchBanner + AuditoriaWebhookTab + RespostasRecebidasHoje); limpar `DisparoCustomizadoCard.tsx` e `ReengajamentoTab.tsx` (remover automação).
- Backend: migração adiciona flag `nutricao_enabled`; editar `cron-nurturing-sequencer` (checar `nutricao_enabled`), `campaign-gate.ts` (permitir manual autenticado), `nurturing-orchestrator` chamadores (só scoring); apagar `visita-amanha-enqueue`.
- Tabelas de nutrição (`nurturing_cadencias`, `lead_nurturing_sequences`, `lead_nurturing_state`) preservadas. WhatsApp 1:1 do CRM não é afetado.
- Memória: atualizar `mem://features/whatsapp/nutricao-manual-only` e criar referência da nova tela.
