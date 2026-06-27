# Apagar/remover parceria no pipeline

Hoje, ao clicar em "Parceria" no card do lead, o diálogo (`PartnershipDialog.tsx`) mostra as parcerias existentes apenas como etiquetas de leitura. Não há como editar nem apagar. Além disso, a tabela `pipeline_parcerias` não tem regra de exclusão configurada.

## O que será feito

### 1. Permissão de exclusão no banco
- Criar uma policy de DELETE em `pipeline_parcerias` permitindo que **admin, gestor e diretor** (CEO) apaguem qualquer parceria, e o corretor principal apague as suas próprias — espelhando a regra de UPDATE que já existe.

### 2. Hook de exclusão
- Adicionar `useDeleteParceria()` em `src/hooks/useParcerias.ts`, que apaga a linha por `id` e invalida os caches (`lead` e `map`), com toast de sucesso/erro — seguindo o mesmo padrão do `useCreateParceria()`.

### 3. UI no diálogo de parceria
Em `PartnershipDialog.tsx`, na lista de "Parcerias existentes":
- Para usuários **gestor / admin / diretor (CEO)** — e para o corretor principal da própria parceria — exibir um botão de lixeira (ícone `Trash2`) ao lado de cada parceria.
- Ao clicar, pedir confirmação (AlertDialog) e então remover a parceria via `useDeleteParceria`, atualizando a lista na hora.
- Permissão verificada com `useUserRole` (`isGestor`, `isAdmin`, `isDiretor`) — gestor/admin/diretor podem remover qualquer parceria; corretor só a própria.

## Comportamento de "tirar de parceria"
Apagar a parceria volta o lead a ter apenas o corretor principal (remove o vínculo do parceiro). O badge de parceria some do Kanban automaticamente após a invalidação do cache.

## Detalhes técnicos
- Único arquivo de UI alterado: `src/components/pipeline/PartnershipDialog.tsx`.
- Hook alterado: `src/hooks/useParcerias.ts` (novo `useDeleteParceria`).
- 1 migração: nova policy DELETE em `pipeline_parcerias`.
- Não altera divisão de comissão, edge functions, nem a lógica de criação existente.

## Pergunta de escopo
O pedido fala em "apagar" — o plano faz exclusão real (DELETE) da linha de parceria. Se preferir manter histórico (encerrar via `status` em vez de apagar), me avise antes de implementar.