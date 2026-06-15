# Destravar a Central de Disparos para o template aprovado `casatua_junho25k`

## Diagnóstico
O toast "🛑 Central travada…" **não** é sobre o template novo. Existem 3 trincos independentes hoje ativos:

1. **Kill-switch global** — `system_flags.campaign_dispatch_enabled = false`
   (motivo antigo: "WABA quality recovery — bombardeio, LGPD, disparos fora do CRM"). É verificado dentro da edge function `reengajamento-descartados-enqueue` (via `campaign-gate.ts`). Enquanto estiver `false`, **nenhum** disparo sai, mesmo destravando o resto.

2. **Pausa manual da Central** — `reengajamento_config.paused = true` e `paused_until_release = true`
   (motivo: "Templates casatua_maio e reativacao_opcoes_perfil_v2 com >70% falha…"). É o texto exato do toast. Verificado no front (`DisparoCustomizadoCard.disparar`) e no loop do enqueue.

3. **Blacklist de templates** — `blocked_templates`: `casatua_maio` e `reativacao_opcoes_perfil_v2`.
   `casatua_junho25k` **NÃO** está nessa lista → passa normalmente. Esses dois continuam bloqueados (templates ruins, devem permanecer).

Ou seja: o bloqueio aponta para templates antigos de baixa qualidade, mas o novo (`casatua_junho25k`, aprovado, imagem ok, baixa falha) está pronto.

## Ação (somente dados, sem mudança de código)
1. **Liberar kill-switch global**: `system_flags.campaign_dispatch_enabled = true`, com `reason` atualizado: "Liberado após verificação Business Manager — uso restrito a templates aprovados (casatua_junho25k). Salvaguardas: rate limit 250/dia, dedup por telefone, opt-out NÃO→inativa, Pausar/Parar."

2. **Tirar a pausa manual da Central**: em `reengajamento_config` → `paused = false`, `paused_until_release = false`, `paused_reason` atualizado para registrar a liberação e a data BRT.

3. **Atualizar o template default da config** para não apontar mais a um template bloqueado: `meta_template_name` e `meta_template_name_2 = 'casatua_junho25k'` (a UI já permite override por disparo, mas o default não pode ser um template na blacklist).

4. **Manter a blacklist** intacta (`casatua_maio` e `reativacao_opcoes_perfil_v2` continuam bloqueados) para impedir reuso dos templates problemáticos.

## Resultado esperado
- O botão "Disparar para 2160 leads" passa a funcionar com `casatua_junho25k`.
- As respostas continuam roteando conforme já implementado (SIM → Fila do CEO; NÃO → inativa/arquiva).
- Os templates antigos de má qualidade seguem bloqueados.

## Observação de segurança
A pausa original foi por qualidade WABA (bombardeio/LGPD). As salvaguardas que mitigam isso já existem na ferramenta atual (rate limit 250/dia, delays, dedup, opt-out automático no NÃO, Pausar/Parar em tempo real). Se durante o disparo a Meta voltar a acusar >X% de falha, o auto-pause por qualidade (já existente no enqueue) re-pausa sozinho.
