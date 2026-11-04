# Clientes que voltam ao pipeline entram sem parceria: limpar o que sobrou

## Por que as parcerias continuavam (consulta só de leitura)
- Até hoje não existia regra para encerrar a parceria quando o cliente era descartado, arquivado ou ficava estagnado. A única regra encerrava a parceria quando o cliente ganhava um corretor novo, e ela só existe desde 27/10.
- Por isso, a parceria ficava "esperando" junto com o cliente. Quando ele voltava, o selo voltava junto.
- **Desde hoje**, a regra nova já encerra a parceria em qualquer volta (reativado, reaproveitado, saiu do descarte ou do arquivo) e em qualquer troca de corretor. O que falta é limpar as parcerias antigas.

## Situação de hoje (344 parcerias marcadas como ativas)
| Grupo | Quantidade | O que fazer |
|---|---|---|
| Cliente ativo que voltou depois de descarte: **Taila Tejada Open** (com Jéssica França) e **Edson Lopes** (com Gustavo Niz) | 2 | Encerrar |
| Cliente **hoje descartado ou arquivado** | 280 | Encerrar agora, para que ninguém volte com parceria antiga |
| Cliente ativo, com parceria de verdade, sem volta depois dela | 49 | Manter |
| **Henrique Souza** (com Pedro Jorge) | 1 | Manter, a seu pedido |
| Jeane e Suellen (da lista anterior) | — | Hoje estão descartadas ou arquivadas, entram no grupo das 280 |

Os números somam um pouco diferente porque o mesmo cliente pode ter mais de uma parceria. Na hora de rodar eu confirmo os totais exatos.

## O que vou fazer
1. Encerrar as parcerias dos dois grupos marcados acima, com o motivo "Encerrada: lead saiu do pipeline / reentrou — vida nova" e um registro no histórico de cada cliente ativo afetado. **Henrique fica de fora.**
2. **Roleta e histórico:** visitas feitas enquanto a parceria valia continuam contando 0,5 para cada corretor. Nada é apagado.
3. **Conferir depois:** o selo "c/ Jéssica" sumiu do cartão da Taila; restam só as 49 parcerias legítimas e a do Henrique; as contagens de visitas da Roleta desta semana não mudaram.
4. **Teste da regra nova** com um cliente de teste: com parceria → descartar → reativar → volta sem parceria. Depois desfaço tudo.

## Detalhes técnicos
- A limpeza é uma alteração de dados (`pipeline_parcerias.status='encerrada'`, `encerrada_em=now()`), feita fora de migration, com exclusão explícita do lead Henrique Souza.
- Comparação das contagens da Roleta (`roleta_visitas_realizadas_periodo`) antes e depois.
