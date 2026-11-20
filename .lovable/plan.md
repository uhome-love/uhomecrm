# Bloquear o acesso do Anderson Amaral (sem apagar nada)

## Situação hoje
- Anderson Amaral da Silva: cadastro ativo, corretor, 42 leads ativos com ele, sem bloqueio de entrada.
- Último acesso ao CRM: 13/11.

## O que será feito
1. Bloquear a entrada dele no CRM (login e sessões abertas deixam de funcionar), do mesmo jeito que o botão "Inativar" já faz.
2. Tirar ele da Roleta, para não receber leads novos.
3. NÃO mexer em mais nada:
   - os 42 leads continuam com ele, nas mesmas etapas;
   - negócios, tarefas, visitas, histórico e equipe ficam como estão;
   - nada é apagado nem repassado.
4. Registrar a ação no histórico de auditoria.

Depois vocês decidem para quem vão os leads; dá para desbloquear a qualquer momento.

## Conferência
- Confirmar que a entrada dele está bloqueada.
- Confirmar que ele saiu da Roleta.
- Contar de novo: 42 leads, negócios e tarefas iguais a antes.

## Detalhes técnicos
- Bloqueio via auth admin `ban_duration` (mesmo usado em `create-broker-user` action inactivate), executado sem o repasse de leads daquela ação.
- Remover só as linhas dele em `roleta_fila`/credenciamento do dia; `profiles.ativo` e `team_members` ficam como estão para não esconder a carteira dos gestores.
- Linha em `audit_log` ("block_user_access").
- Sem migration e sem mudança de código; nada a publicar.
