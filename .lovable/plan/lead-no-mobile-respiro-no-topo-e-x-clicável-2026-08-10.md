# Lead no mobile: respiro no topo e "X" clicável

## Problema

Ao abrir um lead no celular, o painel ocupa a tela inteira colado no topo. O botão de fechar (X) fica embaixo da barra de status/notch do celular e disputa espaço com a fileira de abas (Info / Histórico / Lembretes / Visitas), ficando pequeno e difícil (ou impossível) de tocar.

## O que vai mudar

1. **Respiro superior**: o painel do lead passa a começar abaixo da área segura do aparelho (notch/barra de status) no mobile. No desktop nada muda.
2. **X sempre alcançável**: o botão de fechar ganha área de toque maior (alvo ~40px), fica acima das abas em ordem de empilhamento e respeita a área segura do topo.
3. **Abas sem colisão**: a fileira de abas ganha espaço reservado à direita no mobile, para não passar por baixo do X e continuar rolável horizontalmente.

Resultado: no celular dá para fechar o lead com um toque e usar os botões do topo normalmente.

## Detalhes técnicos

- `src/components/ui/sheet.tsx`: no `SheetPrimitive.Close`, trocar `top-4` por `top-[max(1rem,env(safe-area-inset-top))]`, aumentar a área de toque (padding + ícone maior) e adicionar `z-50`. Mudança puramente visual/posicional, sem alterar API.
- `src/components/pipeline/PipelineLeadDetail.tsx` (linha ~769): no `SheetContent`, adicionar padding-top de área segura no mobile (`pt-[env(safe-area-inset-top)] md:pt-0`), mantendo `max-h-[100dvh]` e o layout de colunas atual.
- Mesmo arquivo (linha ~788): na barra de abas, adicionar `pr-12 md:pr-0` para reservar o espaço do X no mobile.

Sem mudanças de lógica, dados ou backend.

## Validação

Abrir um lead no preview em viewport mobile, conferir: topo com respiro, X clicável, abas roláveis e desktop inalterado.
