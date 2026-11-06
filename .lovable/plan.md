# Parceria: corretoras enxergarem as atualizações uma da outra

## O que foi verificado (cliente Arthur Lake)
- Parceria ativa desde 10/07/2026: Jéssica França (principal, dona do lead) + Rafaela Campos (parceira), 50/50.
- No histórico do cliente há 16 atividades da Jéssica e 11 da Rafaela.
- Confirmado: a Rafaela só enxerga o que ela mesma registrou. A Jéssica, como dona, vê tudo.
- Causa: a regra de acesso de quatro áreas do lead não inclui o parceiro (só dono, autor, gerente e admin):
  - Atividades / histórico de contatos
  - Anotações
  - Tarefas
  - Mudanças de etapa
- Visitas e o próprio lead já reconhecem o parceiro — por isso ela abre o cliente, mas vê o histórico "pela metade".
- Não é só o Arthur: vale para toda parceria ativa em que a parceira não é a dona do lead.

## O que será feito
- Liberar **somente leitura** dessas quatro áreas para o corretor parceiro de uma parceria **ativa**.
- Parceria encerrada (ex.: troca de corretor ou reentrada do lead) volta a esconder, como hoje.
- Nada muda em edição/exclusão, distribuição, Roleta, contagem de visitas ou comissão.
- Sem mudança visual (não há tela nova; por isso sem mockup).

## Validação
- Entrar como a Rafaela (sessão de teste, sem alterar dados) e confirmar que o Arthur Lake mostra as 27 atividades, anotações, tarefas e etapas da Jéssica.
- Confirmar que um corretor fora da parceria continua sem ver.
- Confirmar que parceria encerrada não dá acesso.

## Detalhes técnicos
- Uma migration (respeitando o limite de 2/dia no horário comercial) adicionando políticas SELECT com `is_my_partner_lead(pipeline_lead_id)` em `pipeline_atividades`, `pipeline_anotacoes`, `pipeline_tarefas` e `pipeline_historico`. Mesma função já usada em `visitas` e em `can_access_lead`.
- Conferir que `is_my_partner_lead` filtra `status='ativa'` antes de aplicar.
- Sem alterar políticas de INSERT/UPDATE/DELETE existentes.
