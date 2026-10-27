# Lead reativado começa do zero

## Regra
Todo lead que volta para o pipeline começa do zero, seja por novo interesse, reengajamento, bolsão, oferta ativa, reativação manual ou volta da Fila CEO. Ele chega verde, sem atraso, sem aviso de desatualizado e sem a contagem de estagnação do ciclo anterior. O histórico antigo continua guardado; só os relógios recomeçam.

## O que existe hoje (confirmado)
- O lead pode voltar por vários caminhos diferentes. Só o Bolsão zera todos os relógios.
- Os outros caminhos (reativação, novo interesse, Fila CEO) mudam a etapa e o corretor, mas mantêm as datas antigas. Foi assim que a Marie voltou "estagnada".
- A correção de hoje cobre só o caso em que o corretor aceita o lead de novo.

## O que vou fazer
1. **Uma regra única no banco.** Toda vez que um lead sair de Descarte, Arquivado ou Estagnado e voltar para uma etapa ativa, ou receber um novo corretor por reativação, o próprio banco zera os relógios desse lead. Isso vale para todos os caminhos de volta, inclusive os que forem criados no futuro.
2. **O que é zerado:**
   - data de entrega ao corretor: passa a ser agora;
   - data do último contato: fica vazia, então o relógio conta a partir de agora;
   - marcação de estagnado e os avisos de estagnação;
   - prazo de carência;
   - nível de escalonamento de alertas;
   - aviso de reciclagem.
3. **Tarefas atrasadas do ciclo antigo:** as tarefas que ficaram pendentes do ciclo anterior são encerradas como "canceladas, lead reativado". Assim o lead não aparece com tarefa atrasada. As tarefas concluídas e o histórico não mudam.
4. **Correção dos leads atuais:** aplicar a mesma limpeza aos leads ativos que voltaram nos últimos 30 dias e ainda estão com relógio antigo.

## O que NÃO muda
- Etapa, corretor, distribuição, Roleta e Fila CEO continuam como estão.
- O histórico de atividades e as anotações ficam guardados.
- O corretor que aproveitou um lead continua vendo só o histórico novo.

## Detalhes técnicos
- Criar um trigger `BEFORE UPDATE` em `pipeline_leads` com uma função `reset_ciclo_reentrada`. Ele dispara quando `OLD.arquivado = true` ou a etapa antiga é do tipo descarte ou `OLD.estagnado = true`, e o `NEW` fica ativo fora do descarte. Também dispara quando `reativado_em` ou `reaproveitado_em` mudam.
- O trigger grava `distribuido_em = now()`, `ultimo_toque_at = NULL`, `estagnado = false`, zera `estagnado_em/aviso_em/aviso2_em/prazo_em` e `estagnacao_carencia_ate`, grava `escalation_level = 0`, `last_escalation_at = NULL` e `reciclagem_aviso_at = NULL`.
- Criar um trigger `AFTER UPDATE` que cancela as `pipeline_tarefas` pendentes criadas antes da reentrada.
- Substitui a regra parcial de hoje, que ajusta a entrega pelo aceite. Fica uma regra só, sem duplicar.
- Backfill por consulta de dados nos leads ativos com entrada recente (atividade tipo `entrada` nos últimos 30 dias).
- A migration fica restrita a DDL e conta para o limite de 2 por dia.
- Os testes do `leadSaude` continuam valendo. Adicionar um teste do caso de reentrada.

## Validação
- Com um lead de teste: descartar, reativar e confirmar no board que ele aparece verde, sem tarefa atrasada e sem aviso. Depois apagar o lead de teste.
- Conferir que a Marie e os outros leads que voltaram aparecem verdes.
- Conferir que um lead ativo normal não teve nenhum relógio alterado.
