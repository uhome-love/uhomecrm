# Rolagem em todos os pop-ups do CRM

## Problema
Pop-ups altos (ex.: "Confirmar venda" do print) passam do tamanho da tela e cortam o topo e o rodapé, sem como rolar até os botões.

## O que muda
- Todo pop-up do CRM passa a ter altura máxima igual à tela (com uma pequena margem) e rolagem interna de cima até o fim.
- Vale para os quatro tipos de janela: pop-up central, pop-up de confirmação, painel lateral e painel que sobe de baixo no celular.
- Nada muda no conteúdo, nos botões ou nas regras: só a rolagem.

## Detalhes técnicos
- Ajuste único nos componentes base em `src/components/ui/`: `dialog.tsx` e `alert-dialog.tsx` (`max-h-[calc(100dvh-2rem)] overflow-y-auto`), `sheet.tsx` (`overflow-y-auto` nas laterais, `max-h-[90dvh]` em top/bottom), `drawer.tsx` (`max-h-[92dvh]` + área rolável).
- Assim os ~112 pop-ups herdam a regra sem editar um por um; os que já têm rolagem própria continuam iguais.
- Conferir os que fixam altura própria (`h-[...]`, `overflow-hidden`) e corrigir só se cortarem conteúdo.

## Validação
- Abrir no preview, em tela baixa (desktop 1280x700 e celular), o "Confirmar venda", Jornada do negócio, Visita, Parceria e um painel lateral; confirmar que rola do topo ao botão final. Sempre Cancelar, sem salvar dados.
