# Corrigir repasse de lead estagnado (dropdown vazio/só o próprio gestor)

## Problema
Na página **Leads Estagnados**, ao clicar em **Repassar**, o gestor só vê a si mesmo (ex.: "Bruno Schuler") no seletor de corretor de destino.

## Causa raiz
O seletor usa o hook `useCorretoresOptions` (em `src/hooks/usePipelineEstagnacao.ts`), que consulta a tabela `user_roles`. A política de segurança dessa tabela só permite que um usuário não-admin veja **o próprio registro**. Logo, o gestor recebe apenas ele mesmo na lista.

Em contraste, o repasse dentro do Pipeline (`PipelineTransferDialog`) funciona porque lê a tabela `team_members`, cuja regra de leitura é aberta a qualquer usuário autenticado.

O backend já está correto: a função `decidir_lead_estagnado`, na ação `repassar`, já move o lead de volta para a etapa **Novo Lead** no pipeline do corretor destino. Nenhuma mudança de banco é necessária.

## Solução (somente frontend)
Alterar o hook `useCorretoresOptions` para buscar os corretores em `team_members` (ativos), da mesma forma que o dialog do pipeline:

- Consultar `team_members` com `status = 'ativo'`, trazendo `user_id`, `nome` e `equipe`, ordenado por `nome`.
- Retornar a lista com `user_id` e `nome` (mais `equipe` opcional para exibição).

Assim o gestor passa a ver todos os corretores/equipe disponíveis para repasse.

### Melhoria de exibição (opcional, no `DecisionDialog` de `src/pages/LeadsEstagnados.tsx`)
- Exibir a equipe ao lado do nome do corretor no `SelectItem` (ex.: `Nome — Equipe`), aproveitando o campo `equipe`, para o gestor identificar rapidamente a que time cada corretor pertence.
- Manter o filtro atual que evita repassar para o mesmo corretor de origem.

## Validação
- Como gestor, abrir Leads Estagnados → Repassar: confirmar que a lista mostra vários corretores (a equipe), não apenas o próprio.
- Selecionar um corretor e confirmar: o lead deve sair da estagnação e reaparecer na etapa **Novo Lead** no pipeline do corretor escolhido (comportamento já garantido pela RPC).

## Arquivos afetados
- `src/hooks/usePipelineEstagnacao.ts` — trocar fonte de dados de `useCorretoresOptions` para `team_members`.
- `src/pages/LeadsEstagnados.tsx` — (opcional) exibir a equipe no seletor.
