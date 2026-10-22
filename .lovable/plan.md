# Aviso "sem atualização" deixa o cliente verde no Pipeline

## O que o corretor relatou (áudio + print)
- Recebe "Renata Mohr está sem atualização" (vermelho), mas no Pipeline ela aparece verde.
- Clientes somem do Pipeline (estagnam) mesmo com aviso, e ele só percebe depois.

## O que encontrei (confirmado nos dados)
- A rotina que manda o aviso "sem atualização" (a cada 7 dias sem mexer no cliente), ao avisar, **grava no próprio cliente** que avisou. Essa gravação conta como "última atualização".
- Resultado: no mesmo segundo do aviso, o cliente fica com "atualizado agora" e **fica verde** no Pipeline. Renata, Cintia e Josiane: horário do aviso = horário da "última atualização" (21/10, 18:11 / 18:07 / 17:58).
- Isso aconteceu em **614 avisos nos últimos 30 dias**.
- O mesmo vale para o aviso da cadência Sem Contato ("estagna em 24h"): o caso Dudi também ficou "atualizado" no horário do aviso.
- Enquanto isso, a contagem que realmente estagna o cliente olha só ações do corretor. Ou seja: a tela diz "em dia" e o cliente continua caminhando para estagnar — exatamente a confusão relatada.

## Correção proposta
1. Os avisos automáticos deixam de contar como atualização do cliente. A cor e a "última atualização" voltam a refletir só o que o corretor fez.
2. O aviso "sem atualização" passa a usar essa mesma régua (ação do corretor), não a data técnica de alteração.
3. Corrigir os clientes já afetados: recalcular a "última atualização" a partir da última ação real do corretor, para a cor voltar a ficar certa (amarelo/vermelho onde for o caso).
4. Nenhuma regra de estagnação, cadência ou distribuição muda. O corretor continua recebendo os mesmos avisos; só deixam de esconder o problema.

## Validação
- Antes/depois com a Renata, Cintia e Josiane: cor no Pipeline igual ao aviso.
- Rodar a rotina de aviso numa conferência sem gravar e confirmar que a "última atualização" não muda.
- Conferir ao vivo o Pipeline do corretor (sem alterar clientes reais).

## Detalhes técnicos
- Causa: `detectar_leads_parados` faz `UPDATE pipeline_leads SET last_escalation_at, escalation_level`, o que dispara a atualização de `updated_at` e `ultima_acao_at`. Cadência Sem Contato (aviso 24h) tem o mesmo padrão.
- Migration (após 19h BRT): ajustar o trigger de `ultima_acao_at`/`updated_at` para ignorar updates que mexem só em campos de sistema (`last_escalation_at`, `escalation_level`, campos de aviso da cadência/estagnação); `detectar_leads_parados` passa a usar `_pipeline_ultima_acao_humana`.
- Backfill pontual via run_sql: `ultima_acao_at` = última ação humana para os leads cujo `ultima_acao_at` coincide com uma notificação automática.
