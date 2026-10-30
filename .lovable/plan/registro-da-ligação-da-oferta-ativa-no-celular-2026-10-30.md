# Registro da ligação da Oferta Ativa no celular

## O que o vídeo mostra (16:32–16:33)
1. Ao tocar em "Não atendeu", abre a janela "Resultado da Ligação", mas os nomes dos botões (Aproveitado, Agendar Visita, Não Atendeu, Descarte definitivo) e a palavra "obrigatório" ficam quase invisíveis: a cor das letras foi feita para o tema escuro e some no fundo claro.
2. Não fica claro qual opção está escolhida, e o botão "Confirmar e Próximo" fica apagado sem explicar o motivo: falta escolher o motivo (Caixa postal, Ocupado...), que tem letra muito pequena e é difícil de tocar.
3. A janela some e volta no meio (quadro 4 do vídeo), sinal de toque duplo ou de toque que "vaza" para fora da janela.
4. A ligação é registrada no final ("Tentativa registrada"), mas só depois de várias tentativas.

## O que será feito
1. **Mockup primeiro** (regra do Lucas): imagem da nova janela no celular para você aprovar antes de mexer no código.
2. Botões de resultado com letra legível no tema claro e no escuro, e marcação forte (borda e ✓) na opção escolhida.
3. Quando entra pelo atalho "Não atendeu" / "Sem interesse", a opção já vem marcada.
4. Motivos em botões maiores (fáceis de tocar) e frase "Escolha o motivo para confirmar" acima do botão quando falta.
5. Botão "Confirmar e Próximo" com letra branca. Proteção contra toque duplo: a janela não fecha e reabre sozinha, e a mesma ligação nunca é registrada 2 vezes.
6. Janela com rolagem e botões fixos embaixo em celular pequeno, sem cortar nada.

Nenhuma regra de pontos, cooldown ou registro muda. Só a tela.

## Validação ponta a ponta
- Abrir no tamanho de celular (iPhone) com lead de teste: Não atendeu, Sem interesse, Aproveitado e Descarte. Conferir que a tentativa aparece 1 vez só no banco, no contador "X ligações", na Minha Rotina e no ranking. Repetir no tema claro e no escuro.
- Conferir no banco as tentativas de hoje desse corretor para ver se houve registro em dobro ou perdido.
- Apagar o lead de teste no final.

## Detalhes técnicos
- Arquivo: `src/components/oferta-ativa/DialingModeWithScript.tsx` (`ResultPopup`, cores fixas `#86EFAC`/`#FCA5A5` etc. trocadas por tokens; `text-foreground` do botão azul por `text-primary-foreground`).
- Atalhos rápidos (linha ~1318) passam a definir `selectedResult` ao abrir; overlay com `onClick` stopPropagation e trava `submitting` antes do primeiro await.
- Card com `max-h-[90dvh] overflow-y-auto`, rodapé sticky com safe-area.
