# Repasse dos leads do Anderson Amaral para o Gabriel Vieira (desligamento)

## O que vai acontecer
1. **Leads ativos (42)** passam para o Gabriel Vieira, cada um com o selo **"Herdado de Anderson"** (o mesmo selo que o Pipeline já mostra, com filtro "Herdados").
2. O selo fica **sem prazo**: some só quando o Gabriel decidir — manter com ele (botão já existente) ou repassar para outro corretor.
3. **Negócios em andamento** (Documentação, Proposta, Contrato) vão junto com o lead para o Gabriel.
4. **Tarefas pendentes (32)** passam para o Gabriel, nos mesmos horários.
5. **Parcerias ativas (2)**: o lado do Anderson é encerrado; o outro corretor continua com o cliente dele.
6. Nota em cada lead: "Lead repassado ao gerente por desligamento de Anderson Amaral".

## O que fica preservado (relatórios)
- Vendas assinadas (Ganho), VGV, comissões, intermediações e visitas já feitas continuam no nome do Anderson e na equipe da época.
- Descartados e inativos ficam como estão (não voltam a ativo).
- Histórico, anotações e atividades antigas não são apagados.
- Acesso continua bloqueado; o cadastro dele é marcado como inativo para sair da Roleta e das listas de escolha de corretor.

## Conferência
- Antes: contagens de leads, negócios e tarefas do Anderson.
- Depois: Anderson com 0 leads/tarefas ativos; Gabriel com +42 leads com selo; vendas do Anderson iguais nos relatórios.
- Conferir no Pipeline do Gabriel (computador e celular) o selo e o filtro "Herdados", sem clicar em ações.

## Detalhes técnicos
- Uma transação SQL: `pipeline_leads` ativos (não arquivados) com `corretor_id`=Anderson → Gabriel, `herdado_de_corretor_id`=user_id do Anderson, `herdado_em=now()`, `herdado_decidido_em=null`, `gerente_id` mantido. Gatilho de troca de corretor já encerra parcerias.
- `negocios` não ganhos/não distrato do Anderson → corretor Gabriel (profiles.id). Ganhos intocados.
- `pipeline_tarefas` pendentes → responsável Gabriel.
- `pipeline_anotacoes` + `audit_log` do repasse.
- `profiles.ativo=false` só após conferir que relatórios usam `equipe_historico` e vendas não somem com corretor inativo.
- Sem migration (só dados), sem mudar regras do CRM.
