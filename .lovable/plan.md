## Objetivo

No modal "Incluir Corretor na Roleta", a lista de Segmentos aparece fora de ordem (S4, S3, S5, S1, S6, S2). Quero exibir sempre na ordem S1, S2, S3, S4, S5, S6.

## Causa

Em `src/hooks/useRoleta.ts`, a função `loadSegmentos` busca `roleta_segmentos` sem `ORDER BY`, então a ordem é arbitrária. Como os nomes têm prefixo `S1 - … S6 - …`, ordenar por `nome` já produz a sequência correta.

## Mudança

- Em `src/hooks/useRoleta.ts` (`loadSegmentos`), adicionar `.order("nome")` na consulta a `roleta_segmentos`, garantindo S1→S6 em todos os lugares que consomem `segmentos` (modal de inclusão, selects de credenciamento, etc.).

## Verificação

- Abrir o modal "Incluir Corretor na Roleta" e confirmar a ordem S1, S2, S3, S4, S5, S6.

Apenas mudança de frontend (ordenação de leitura), sem alterar dados.