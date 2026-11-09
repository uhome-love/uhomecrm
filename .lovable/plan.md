# Aproveitamento seguro na Oferta Ativa (Listas, Estagnados e Descartados)

## Objetivo
Um cliente só pode ter **um dono** no Pipeline. Nenhum clique duplo, nenhuma corrida entre dois corretores e nenhuma porta diferente (ligação ao vivo ou Histórico) pode criar cliente repetido ou tirar cliente de outro corretor.

## O que encontrei (riscos de hoje)
1. **Corrida entre corretores:** cada porta confere duplicidade por conta própria e sem trava pelo telefone. Se dois corretores aproveitarem o mesmo telefone ao mesmo tempo (ex.: o cliente está numa lista e também no Bolsão), os dois podem passar.
2. **Bolsão em várias etapas soltas:** o aproveitamento de Estagnados/Descartados faz "conferir → mover → registrar" em passos separados. Se algo cair no meio, fica pela metade, e a reserva pode trocar de dono nesse intervalo.
3. **Histórico das Listas cria cliente novo** mesmo quando já existe o mesmo telefone arquivado ou descartado no Pipeline. O certo é trazer de volta esse cliente, não criar uma cópia.
4. **Cliente arquivado conta como "com outro corretor"** no Histórico. Isso bloqueia para sempre um cliente que ninguém está atendendo.
5. **Estagnados e Descartados não aparecem no Histórico.**

Hoje há **0 telefones duplicados** entre clientes ativos do Pipeline. A regra nova mantém isso.

## Regra única (vale para as 3 origens e para as 2 portas)
Ao tocar em **Aproveitar**:
1. O sistema trava aquele telefone, para que ninguém mais aproveite o mesmo cliente no mesmo instante.
2. Ele confere:
   - O cliente pediu para sair ou já comprou? → não aproveita e mostra o aviso.
   - O cliente está **ativo** com outro corretor? → mostra "Já está com Fulano" e não muda nada.
   - O cliente está ativo comigo? → mostra "Já está no seu Pipeline" e abre ele.
   - Outro corretor está ligando para ele **agora** (reserva ativa)? → mostra "Outro corretor está falando com ele agora".
   - Pelo Histórico, só aproveita quem **eu** liguei nos últimos 30 dias, e só se ninguém tiver mexido no cliente depois.
3. Se passar em tudo:
   - Se o cliente já existe no Pipeline, mas arquivado, descartado ou estagnado, ele é **trazido de volta** para mim em Novo Lead, sem criar cópia. As parcerias antigas encerram pela regra de reentrada que já existe.
   - Se o cliente não existe no Pipeline, ele é criado para mim.
4. Tudo acontece numa única operação: ou grava tudo, ou não grava nada.
5. Tocar duas vezes devolve o mesmo cliente, sem duplicar nem somar ponto de novo.
6. O placar não muda de regra: aproveitado pelo Histórico conta como aproveitado, mas não como ligação.

## Tela (mudança pequena)
O Histórico passa a mostrar também Estagnados e Descartados, com uma etiqueta de origem:

```text
Juliane Bazzo        (41) 99903-7424 · Casa Tua POA
[Estagnados] Não atendeu · 08/11 15:20              [Aproveitar]
```

Filtros: Todas | Listas | Estagnados | Descartados, além dos filtros por resultado que já existem.

## Validação (sem risco a clientes reais)
- Usar só clientes fictícios, numa lista de teste e em clientes de teste do Bolsão, e apagar tudo no final.
- Testar cada cenário pelas duas portas e nas 3 origens:
  - cliente livre;
  - com outro corretor;
  - comigo;
  - arquivado (volta sem cópia);
  - opt-out;
  - clique duplo;
  - **dois corretores ao mesmo tempo** (disparo simultâneo: só um ganha);
  - reserva de outro em andamento.
- Conferir no banco, depois de cada caso: um único dono, nenhuma cópia, placar e ranking corretos.
- Conferir no computador e no celular.
- Fazer, por fim, uma revisão ponta a ponta da Oferta Ativa inteira (entrada, ligação, 5 resultados, Histórico, ranking, TV) para caçar erros.

## Detalhes técnicos
- Nova função de banco `oa_aproveitar(p_origem, p_lead_id, p_via)`, SECURITY DEFINER, com search_path fixo e `pg_advisory_xact_lock` pelo telefone normalizado. Ela substitui a lógica de `oa_historico_aproveitar` e a parte de reativação de `bolsao-aproveitar`.
- O SQL replica `reactivateLead`: gerente via `team_members`, `arquivado=false`, `aceite_status='aceito'`, limpar descarte/reengajamento, `reaproveitado_em`, limpar campos de estagnação, atividade. O trigger `reset_ciclo_reentrada` continua cuidando de prazos, tarefas e parcerias.
- "Ativo" = não arquivado, etapa diferente de descarte e não estagnado (mesma régua de `bolsao_puxar`).
- A edge `bolsao-aproveitar` vira um invólucro fino que chama a função; o caminho ao vivo das Listas (`finalizar_tentativa_v2`) passa pela mesma trava e checagem de dono antes de criar o cliente.
- O Histórico lê `bolsao_reservas` do próprio corretor (Estagnados/Descartados) junto com as tentativas das Listas.
- Uma migration (DDL) fora do pico.
- Testes unitários para o mapeamento dos status no app.
