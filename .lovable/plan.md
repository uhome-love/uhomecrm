# Placar da TV: contar qualquer visita agendada no dia (1 por cliente por sessão)

## O que verifiquei agora (dados reais de hoje, 14/08)

- Visitas marcadas fora do mutirão **já contam** no placar: existe o gatilho `trg_visita_conta_mutirao` em `visitas`, que cria/atualiza o participante, soma 30 pontos, grava no extrato (`oferta_ativa_ligacoes`, origem `pipeline`) e dispara a celebração.
- Sessão de hoje está `ao_vivo` (09:30 → 21:30 BRT).
- Hoje foram criadas **8 visitas** e só **3 pontuaram**. As 5 que não pontuaram foram bloqueadas pela regra atual "só cliente inédito no funil":
  - Paulinha Paim (visita anterior 09/07, realizada)
  - Daniele Russi Jardim (26/06, realizada)
  - patricia (várias visitas de jun/jul)
  - Alexandre Tadashi (31/07, no_show)
  - Carlos Temes Quadros (04/08, realizada)

Ou seja: o furo não é "pipeline não conta", é a trava de cliente inédito criada em 31/07.

## Nova regra (decidida)

**1 visita pontuada por cliente por sessão.** Toda visita criada durante o mutirão pontua 30, inclusive remarcação de cliente que já visitou em outras datas — desde que aquele cliente ainda **não** tenha pontuado na sessão de hoje.

Mantém-se:
- 30 pontos por visita, aproveitado 5, tentativa 0.
- Visita marcada dentro do mutirão continua contando uma única vez (sem duplicar com a do pipeline).
- Vale para qualquer corretor, participando ou não do mutirão (entra no placar automaticamente).
- Conta pelo dia em que a visita foi **marcada** (BRT), não pela data da visita.

## O que muda tecnicamente

1. Migration substituindo `public.trg_visita_conta_mutirao`:
   - **Remover** o bloqueio "existe visita anterior do mesmo cliente em qualquer data".
   - **Manter/reforçar** o dedup por sessão usando a mesma chave SSOT (`pipeline_lead_id` > telefone só dígitos > nome normalizado): se já existe linha `visita_agendada` na sessão para aquele cliente, não pontua de novo.
   - Para o dedup funcionar por cliente mesmo sem lead vinculado, comparar contra as visitas da sessão (join `oferta_ativa_ligacoes` × `visitas` do dia) em vez de só `pipeline_lead_id` + janela de 15 min.
   - Continua `SECURITY DEFINER` com `EXCEPTION WHEN OTHERS` para nunca bloquear o agendamento da visita.
2. Sem mudança de frontend: `PlacarTv`, `RankingPanel` e a função `oferta-ativa-ranking` já leem os contadores/extrato.
3. Backfill opcional da sessão de hoje: reprocessar as 5 visitas bloqueadas (Paulinha, Daniele, patricia, Alexandre Tadashi, Carlos Temes) para somar +30 a cada corretor e aparecer no placar. Confirmar se quer isso — sem backfill, a regra nova só vale das próximas visitas em diante.

## Validação após o build

- Conferir na TV que os 5 corretores acima ganharam a visita (se o backfill for aprovado).
- Marcar uma visita de teste por fora do mutirão e ver contador +1, +30 pontos e pop-up de celebração.
- Marcar segunda visita do mesmo cliente de teste na mesma sessão: **não** deve pontuar de novo.
- Excluir a visita de teste ao final.

## Atualização de memória

A regra `mem://features/oferta-ativa/visita-pontua-so-cliente-inedito` será reescrita para "1 visita por cliente por sessão".
