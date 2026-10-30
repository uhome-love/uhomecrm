# Ligações do Bolsão (Estagnados/Descartados) contando na Oferta Ativa

## O que encontrei
- As ligações feitas pelo Bolsão (portas Estagnados e Descartados) só aumentam um contador interno da reserva. Elas não entram no registro de ligações da Oferta Ativa.
- Todos os números do corretor (Minha Rotina, ranking, checkpoint, painel CEO/gerente, placar) leem só esse registro da Oferta Ativa. Por isso essas ligações não aparecem.
- Nos últimos 30 dias foram **984 ligações em 615 reservas, de 19 corretores**, que não entraram na conta.

## O que vou fazer
1. A partir de agora, toda ligação registrada no Bolsão (atendeu, não atendeu, sem interesse, aproveitado) também entra no registro de ligações da Oferta Ativa do corretor, com origem "Bolsão". Pontuação igual à da Oferta Ativa (tentativa 0, aproveitado 5).
2. Visita marcada pelo Bolsão continua pontuando como hoje (sem contar duas vezes).
3. Recuperar o passado: lançar as ligações do Bolsão já feitas, na data em que foram feitas. Mostro antes a lista por corretor para você aprovar.
4. Testar com cliente de teste: ligar pelo Bolsão e ver o número subir na Minha Rotina e no painel; depois apagar o teste.

## Detalhes técnicos
- `bolsao_registrar` passa a inserir em `oferta_ativa_tentativas` (corretor_id = auth.uid(), canal 'ligacao', resultado mapeado, origem/lista nula ou marcador 'bolsao'), dentro da mesma transação, com EXCEPTION para nunca impedir o registro da reserva.
- Verificar colunas obrigatórias de `oferta_ativa_tentativas` (lead_id/lista_id) antes; se exigir lead da OA, adicionar coluna nullable `pipeline_lead_id` + `origem` (migration aditiva).
- Backfill: o histórico por ligação pode não existir (só contador). Se não houver data por tentativa, lançar com a data da reserva e avisar.
