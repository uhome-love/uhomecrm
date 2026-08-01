# Equipe histórica: preservar o VGV do time Gabrielle

## O problema (confirmado nos dados)

Hoje a equipe de uma venda é resolvida pela equipe **atual** do corretor (`v_corretor_equipe`, que lê o snapshot de `team_members`). Como os corretores da Gabrielle foram remanejados, todo o histórico deles migrou junto:

- Matheus Pasin: 4 vendas até 17/06 (inclui **Lake Eyre — Miguel Padilha, R$ 2,64M**) contando hoje como equipe Bruno.
- Larissa Barbosa: 4 vendas até 15/06 (inclui **Luana Tiktok, R$ 320 mil**) contando hoje como equipe Bruno.
- Thalia de Oliveira: 6 vendas (R$ 2,87M) contando hoje como equipe Gabriel.
- Taynah e Natalia continuam marcadas como "Gabrielle" só porque ficaram inativas.

Ranking atual de equipes (todas as vendas de 2026): Bruno R$ 26,5M · Gabriel R$ 20,1M · Junior R$ 4,3M · Gabrielle R$ 2,44M — números misturados.

## A solução

Guardar a **história** de qual equipe cada corretor pertencia em cada período e resolver a equipe **pela data da venda**, não pelo cadastro de hoje.

### 1. Tabela de histórico de equipe

Nova tabela `equipe_historico`: corretor, equipe, gerente, `vigencia_inicio`, `vigencia_fim` (aberta = atual). Backfill:

- Período **até 20/06/2026** → equipe **Gabrielle** para: Leo Dornelles, Jessica França, Flávio Dias, Halime, Taynah, Thalia Oliveira, Matheus Pasin, Larissa Barbosa, Luiza Clos, Natalia Bitencourt.
- Período **a partir de 21/06/2026** → equipe atual de cada um (Bruno / Gabriel / etc., conforme `team_members`).
- Todos os demais corretores: um único período aberto com a equipe atual (comportamento igual ao de hoje).

Observação: Leo Dornelles, Jessica França, Flávio Dias e Luiza Clos não existem hoje em `team_members`/`profiles` com esses nomes — vou confirmar os cadastros e, se não houver vendas ganhas no nome deles, o backfill deles não muda nenhum número (só deixa a história registrada).

### 2. Resolver equipe pela data

- Função `fn_equipe_na_data(corretor, data)` retornando equipe + gerente daquele momento.
- `v_fato_venda` passa a expor `equipe` (histórica, pela `data_assinatura`) além de `equipe_atual`.
- Mesma regra aplicada a `v_fato_visita` e `v_fato_lead`, para o funil da equipe não contradizer o VGV.
- `rpc_metricas` passa a agrupar por (corretor + equipe do período), de modo que um corretor que trocou de time no meio do intervalo aparece nas duas equipes com os valores certos.

### 3. Onde aparece

- **Performance › Equipe › Ranking de equipes**: "Gabrielle" volta a aparecer com o VGV histórico (Lake Eyre, Luana, Taynah, Natalia, Thalia etc.), e Bruno/Gabriel ficam só com o que produziram depois de 21/06.
- **Vendas realizadas**: coluna/rótulo de equipe passa a ser a equipe da época da assinatura.
- Marcação de "equipe histórica / gerente à época" nos tooltips para não confundir com o time atual.

### 4. Gabrielle como diretora

Ela mantém o papel `diretor` (já tem) e passa a enxergar o VGV de todas as equipes. A equipe "Gabrielle" fica registrada como **encerrada em 20/06/2026** — não recebe vendas novas, só preserva o histórico.

## Validação antes de dar por pronto

Comparativo antes/depois por equipe e por corretor, conferindo que:
- a soma total de VGV da empresa não muda (só a distribuição entre equipes);
- Lake Eyre/Matheus e Luana/Larissa aparecem em Gabrielle;
- vendas de Pasin de 22/06 em diante ficam em Bruno.

## Detalhes técnicos

- 1 migration: `equipe_historico` (+ GRANTs + RLS de leitura autenticada), `fn_equipe_na_data`, recriação de `v_fato_venda`/`v_fato_visita`/`v_fato_lead` e `rpc_metricas`, backfill com corte em 2026-06-20.
- Cutoff configurável por linha (não hardcoded na view), para futuras trocas de equipe serem só um INSERT.
- `v_corretor_equipe` continua existindo para "equipe atual" (pipeline, roleta, PDN) — nada de operação muda.
