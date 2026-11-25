# Desligamento do corretor William Ferreira

Mesmo processo já usado com o Anderson Amaral.

## Situação hoje (conferida no banco)
- William Ferreira: ativo, equipe do Gabriel Vieira
- 9 clientes ativos: 4 Atendimento, 4 Aquecimento, 1 Ganho (venda)
- 8 tarefas pendentes, 3 negócios

## O que será feito
1. Bloquear a entrada dele no CRM e encerrar sessões abertas; tirar da Roleta de hoje.
2. Repassar os 8 clientes ativos (Atendimento/Aquecimento) para o Gabriel Vieira com o selo "Herdado de William Ferreira" (filtro "Herdados"), para o Gabriel decidir o repasse.
3. Passar as 8 tarefas pendentes para o Gabriel e deixar uma nota em cada cliente explicando o repasse.
4. Manter com o William o cliente com venda ganha e os 3 negócios: vendas, VGV e relatórios antigos continuam no nome dele.
5. Não mexer em descartados, inativos nem histórico; parcerias ativas encerram sozinhas na troca.
6. Marcar o cadastro como inativo, fechar a participação na equipe com data de hoje (relatórios antigos seguem contando para a equipe do Gabriel na época) e registrar auditoria.

## Validação ponta a ponta
- William: entrada bloqueada, 0 sessões, fora da Roleta, inativo, só o cliente ganho
- Gabriel: +8 clientes com selo pendente e +8 tarefas
- Vendas e equipe histórica do William intactas
- Conferir na tela do Pipeline do Gabriel o filtro "Herdados" (computador e celular)

## Detalhes técnicos
- auth.users.banned_until, delete auth.sessions, roleta_fila/roleta_credenciamentos do dia
- pipeline_leads: corretor_id=Gabriel, herdado_de_corretor_id=2a37e6a8, herdado_em=now(), e reforçar herdado_decidido_em=null (o gatilho de troca preenche)
- profiles.ativo=false, team_members.status='inativo', equipe_historico.vigencia_fim=hoje, audit_log
- Só alteração de dados, sem migration
