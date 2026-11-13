# Corrigir "Etapa de Descarte não encontrada"

## O que acontece hoje
Ao descartar um lead pelo menu do cartão (celular ou computador), aparece o erro e nada é salvo. A etapa Descarte existe e está ativa no banco; o problema é que a janela de descarte procura a etapa só na lista de etapas visíveis do Pipeline, e o Descarte deixou de fazer parte dessa lista (ele virou botão).

## Correção
- A janela de descarte passa a buscar a etapa Descarte direto no banco quando ela não estiver na lista recebida (mesmo jeito que o descarte pela tarefa já faz).
- Nada muda no resultado: motivo, ida para Descarte, nutrição e Oferta Ativa seguem iguais. "Inativar" não é afetado.

## Detalhes técnicos
- `DiscardLeadDialog.tsx`: se `stages` não tiver `tipo='descarte'`, consultar `pipeline_stages` (`pipeline_tipo='leads'`, `tipo='descarte'`) antes de mostrar o erro.
- Sem mudança no banco.

## Validação
- Descartar e cancelar/usar lead de teste no computador e no celular (390px), conferir que vai para Descarte; apagar o lead de teste.
