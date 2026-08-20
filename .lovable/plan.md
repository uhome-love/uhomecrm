# Botão "Repassar" na aba Reengajamento da Fila CEO

## O que aconteceu

O botão foi adicionado na sessão anterior, mas o código atual em `src/components/pipeline/FilaCeoDispatchModal.tsx` não tem mais esse trecho na aba Reengajamento — os pushes recentes do GitHub sobrescreveram o arquivo. Hoje o botão existe só nas abas Novos (linha ~647) e LIA (linha ~542).

## O que fazer

Reaplicar o botão em cada card da lista de leads de reengajamento (bloco `leadsReengajamento.map`, linhas ~568-590):

- Adicionar um botão "Repassar" (ícone `UserPlus`, `size="sm"`, `variant="outline"`) alinhado à direita do card, no mesmo padrão visual das abas Novos e LIA.
- Ao clicar, chamar `setRepasseLead({ id, nome })`, que já abre o `FilaCeoRepassarDialog` existente no fim do componente (estado e diálogo já estão no arquivo, sem mudanças necessárias).

Nenhuma mudança de backend, RPC ou regra de distribuição — apenas UI.

## Validação

Abrir Fila CEO > aba Reengajamento no preview, confirmar o botão nos 3 leads (Agnelo, Montanha, Marcus) e abrir o diálogo de repasse sem concluir a atribuição.
