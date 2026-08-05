# Liberar a Central de Reengajamento para disparar `casatua_novidadeterraco`

## O que está acontecendo hoje (verificado)

- A configuração da Central está em pausa manual travada: `paused = true`, `paused_until_release = true`, com o motivo *"Pausa crítica: 42% de bloqueios Meta recentes (13/31) no template convite_decorado_lake_baikal"*, registrada em 02/08 às 14:29 BRT.
- Enquanto `paused_until_release` estiver ligado, a tela bloqueia o botão antes mesmo de chamar o backend — é o toast "⛔ Central travada".
- O template que você quer usar (`casatua_novidadeterraco`) **não** está na lista de templates bloqueados. Os bloqueados hoje são apenas `casatua_maio` e `reativacao_opcoes_perfil_v2`.
- A trava é do template antigo (`convite_decorado_lake_baikal`), não do Casa Tua.
- O motor de disparo já está ligado no nível global (`campaign_dispatch_enabled = true`), e disparos manuais passam pelo gate global normalmente.

Ou seja: falta apenas destravar a pausa de qualidade herdada de 02/08.

## O que vou fazer

1. **Liberar a pausa manual** da Central: desligar `paused` e `paused_until_release`, limpar o motivo antigo e reiniciar a janela de guarda de qualidade (para o monitor de falhas recomeçar a contar do zero neste disparo, sem herdar as falhas do template antigo).
2. **Conferir ao vivo** no preview: abrir a aba Disparo manual, confirmar que o aviso vermelho de pausa crítica sumiu e que o botão "Disparar 5.000" fica habilitado — sem apertar o disparo (quem dispara é você).

Não vou alterar filtros, público, template nem a imagem do header — o disparo que você armou fica exatamente como está.

## Proteções que continuam ativas

- Templates bloqueados seguem bloqueados (`casatua_maio`, `reativacao_opcoes_perfil_v2`).
- A auto-pausa por qualidade continua funcionando: se este disparo começar a levar bloqueio da Meta acima do limite, a Central se trava de novo sozinha.
- Supressões, opt-out, higiene de pipeline ativo e janela de reenvio continuam iguais.

## Detalhe técnico

- Alteração de dados (DML, sem migration de schema) em `public.reengajamento_config` (linha única `f0d84290-…`): `paused = false`, `paused_until_release = false`, `paused_reason = null`, `guard_reset_at = now()`, `updated_at = now()`.
- Nenhuma mudança de código de frontend ou de edge function.
