# Repassar manualmente (Fila CEO) — incluir diretoria e gerentes

## Situação atual (verificada)

O botão "Repassar manualmente" da Fila CEO abre o diálogo `FilaCeoRepassarDialog`, que monta a lista de destinatários com uma única consulta: `team_members` com `status = 'ativo'`.

Consulta feita na base de produção:

- Bruno Schuler — está em `team_members` como ativo (aparece hoje)
- Junior Padilha — está em `team_members` como ativo (aparece hoje)
- Gabriel Vieira — está em `team_members` como **inativo** (NÃO aparece hoje)
- Gabrielle Rodrigues — **não existe** em `team_members` (NÃO aparece hoje)

Ou seja: dos quatro pedidos, dois não aparecem na lista, e os dois que aparecem estão misturados no meio dos corretores.

## O que vai mudar

No diálogo de repasse manual da Fila CEO:

1. Além dos corretores ativos, a lista passa a incluir a **Diretoria e os Gerentes**: Gabrielle Rodrigues, Gabriel Vieira, Bruno Schuler e Junior Padilha.
2. Eles aparecem em uma **seção separada no topo** ("Gestão"), com uma etiqueta de cargo (Diretora / Gerente), antes da seção "Corretores".
3. A busca por nome continua funcionando nas duas seções.
4. Duplicidade é eliminada: quem já está em `team_members` (Bruno, Junior) aparece só uma vez, na seção Gestão.
5. Nada mais muda: a ação de confirmar o repasse (atribuição do lead, aceite automático, notificação e registro em auditoria) continua exatamente igual.

## Detalhes técnicos

Arquivo único a alterar: `src/components/pipeline/FilaCeoRepassarDialog.tsx`.

- Manter a query atual de `team_members` (`status = 'ativo'`).
- Adicionar uma segunda query paralela em `profiles`, filtrando `ativo = true` e `cargo` em (`gerente`, `diretor`, `diretora`), selecionando `user_id, nome, cargo`.
- Unir as duas listas em memória, com `user_id` como chave de deduplicação; a entrada de gestão tem precedência.
- Renderizar dois grupos no mesmo container rolável, com cabeçalhos discretos "Gestão" e "Corretores"; o filtro de busca é aplicado antes do agrupamento.
- Sem migration, sem mudança de RLS, sem alteração de lógica de distribuição/roleta.

## Validação

Abrir Dashboard CEO → Fila CEO → "Repassar manualmente" em um lead de teste e conferir que os quatro nomes aparecem na seção Gestão e que a lista de corretores segue igual. Cancelar sem confirmar.
