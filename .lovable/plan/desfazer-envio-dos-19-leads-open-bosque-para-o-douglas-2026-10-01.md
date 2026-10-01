# Desfazer envio dos 19 leads Open Bosque para o Douglas

## Situação (verificado)
- 19 leads Open Bosque foram distribuídos ao Douglas Costa hoje entre 14:21 e 14:22 (horário de Brasília).
- 9 ele já aceitou; 10 ainda aguardam aceite.

## O que será feito
1. Tirar o Douglas dos 19 leads e voltar todos para a Fila do CEO, como Open Bosque e na etapa inicial (do jeito que estavam antes do repasse).
2. Cancelar as tarefas automáticas que nasceram com o repasse e marcar como lidos os avisos de "novo lead" que o Douglas recebeu.
3. Registrar na linha do tempo de cada lead: "Repasse ao Douglas desfeito — devolvido à Fila do CEO".
4. Não mexer em mais nada: anotações, histórico da mensagem enviada e a resposta "Sim" continuam no lead.

## Validação
- Contar que os 19 aparecem na Fila do CEO e que o Douglas fica com 0 leads Open Bosque de hoje.
- Abrir a Fila do CEO no preview e conferir.

## Detalhes técnicos
- Só update de dados (sem migration) nos 19 ids de `pipeline_leads` com `corretor_id=70b93b6e…`, `empreendimento_canonico_id=6ade58aa…`, `distribuido_em` de hoje: zerar `corretor_id`, `aceite_status`, `distribuido_em`/aceite, voltar aos valores que a RPC `reativar_lead_para_fila_ceo` grava (conferido antes de executar no histórico de distribuição).
- `pipeline_tarefas` pendentes criadas após 17:21 UTC nesses leads → cancelada; `pipeline_atividades` insert de registro.
