# Open Arvoredo no foco de todos os corretores do Open Bosque

## Hoje
- Open Arvoredo: 6 corretores (Ebert, Gustavo Niz, Larissa, Paula, Rafaela Campos, William).
- Open Bosque: 17 corretores.

## O que muda
Incluir o Open Arvoredo no foco dos 11 corretores que atendem o Open Bosque e ainda não têm o Arvoredo:
Adriana Kaiser, Billy John, Douglas Costa, Gabriel Barreto, Géssica Santos, Jéssica França,
Lucas Johnson, Marcos Aurelio Farias, Pedro Jorge, Roni Klusener, Wendel Flores.

- Os 6 que já estão no Arvoredo continuam.
- Nenhum outro produto sai do foco de ninguém (só acrescenta).
- Não muda nada nos leads que já existem nem na Fila CEO.

Resultado: o Open Arvoredo passa a ter 17 corretores no foco.

## Validação
- Abrir Foco Corretores e conferir os 17 nomes no Open Arvoredo.

## Detalhes técnicos
- Atualização de dados (run_sql) em `corretor_alocacao`: acrescentar o id do Open Arvoredo
  (`5a0427ce…`) em `empreendimentos` das linhas que têm o Open Bosque (`6ade58aa…`) e ainda
  não têm o Arvoredo; atualizar `atualizado_em`. Sem migration.
