# Corrigir modal de registro de ligação (não dá para digitar na Observação)

## Problema
O modal `CallFocusOverlay` é renderizado via `createPortal(document.body)` enquanto o drawer do lead (`Sheet` do Radix) está aberto. O focus trap do `Sheet` rouba o foco do `<Textarea>` de Observação (que está fora do `SheetContent`), impedindo clicar e escrever. O mesmo afeta os `<Input>` de data/hora.

## Causa raiz
Foco preso pelo `FocusScope` do Radix no `SheetContent`; o conteúdo do portal está fora desse escopo.

## Correção (frontend apenas)
Converter `src/components/pipeline/CallFocusOverlay.tsx` para usar os primitivos de Dialog do Radix (`@/components/ui/dialog`) em vez do `createPortal` manual. Diálogos aninhados do Radix empilham os focus scopes corretamente: o diálogo de cima (CallFocusOverlay) passa a deter o foco e o `Sheet` pai libera o trap enquanto ele estiver aberto.

Passos:
1. Trocar a estrutura de retorno: remover `createPortal` e a `<div>` overlay manual; usar `Dialog` + `DialogContent` controlados por `isOpen`/`onClose` (`open={isOpen}` e `onOpenChange` chamando `onClose`).
2. Migrar todo o conteúdo atual (header, progress steps, body das fases 1/2/3 e footer) para dentro do `DialogContent`, mantendo a mesma aparência (largura ~560px, cantos arredondados, layout em coluna com header/body rolável/footer).
3. Remover os `stopPropagation`/`preventDefault` manuais de pointer/mouse que existiam para contornar o problema, já que o Radix passa a gerenciar overlay e cliques.
4. Garantir que o `<Textarea>` de Observação e os `<Input type="date/time">` fiquem plenamente focáveis e editáveis.
5. Manter intactos: lógica de fases, `handleSalvar`, criação de próxima tarefa, movimentação de etapa e os botões "Atendeu/Não atendeu", "Continuar", "Salvar e fechar".

## Verificação
- Testar no preview: abrir um lead → botão **Ligar** → escolher "Não atendeu" → clicar e digitar na Observação → escolher próxima tarefa/data/hora → "Salvar e fechar".
- Confirmar também o fluxo "Atendeu" → "Continuar" → fase 3 → "Salvar tudo e fechar".
- Conferir que o drawer do lead continua funcionando normalmente após fechar o modal.

## Observação
O `WhatsAppFocusFlow.tsx` usa o mesmo padrão `createPortal` e pode ter o mesmo problema, mas não tem campo de texto livre relatado. Fora do escopo agora; posso corrigir depois se desejado.