# Placar TV — ocupar a tela e ficar legível de longe

## O que está errado (verificado no código)

Olhando a foto junto com `PlacarTv.tsx`, são três causas somadas:

1. **Escala híbrida deixa margem.** Hoje a escala é a média entre "caber" e "largura cheia" (`(byWidth + contain)/2`), então o palco nunca chega a ocupar a largura toda da TV — sobra faixa nas laterais e em cima.
2. **Tipografia em `vw` dentro de um palco escalado.** Vários tamanhos usam `clamp(..., Xvw, ...)`, que mede a janela real e depois ainda é multiplicado pela escala. Resultado: o título, nomes de equipe e cabeçalhos ficam bem menores do que o palco de 1920px pede.
3. **Textos fixos minúsculos.** Rótulos de 8-10px (LIGAÇÕES, PONTOS, EQUIPE, horário do feed, rodapé) e o ranking lateral (nome 18px, pontos 26px) são pequenos até no desenho original — numa TV a 3-4 metros viram ilegíveis, e é o que aparece na foto (coluna direita "borrada").

## O que será feito

1. **Palco preenche a largura inteira** — escala volta a ser `largura da tela / 1920`, com o excedente vertical apenas centralizado/cortado nas bordas (áreas já vazias). Sem faixas laterais.
2. **Fim dos `vw`** dentro do palco: todos os tamanhos passam a ser px fixos dimensionados para 1920x1080, então o que se vê na TV é exatamente o desenho escalado.
3. **Tipografia ampliada em bloco** (aproximadamente):
   - Título "Mutirão Ao Vivo": 40 → 64px; data/relógio 11 → 20px.
   - KPIs do topo (número): +40%; rótulos 10 → 16px.
   - Cards de equipe: nome da equipe até 48px, rótulos 9 → 15px, números de ligações/aprov./pontos maiores e alinhados.
   - Ranking dos corretores: nome 18 → 30px, pontos 26 → 44px, linha de memória de cálculo ("3 vis. ×30 + 5 aprov. ×5") 9 → 15px, avatar 40 → 56px.
   - Últimas Conquistas: nome 18 → 28px, descrição/hora 10 → 16px, avatar 44 → 60px.
   - Rodapé com a legenda de pontuação: 9 → 15px.
4. **Menos ar dentro dos cards**: conteúdo das linhas de equipe centralizado verticalmente com padding proporcional, para o card crescido não ficar com o vazio da foto.
5. **Ranking mostra 8 corretores** como hoje, mas com linhas maiores; se não couber, cai para 7 automaticamente pela altura disponível.
6. `?scale=0.95` continua funcionando para TVs com overscan.

## Validação

Capturar `/placar-tv` em 1920x1080, 1600x900, 1366x768 e 1280x720 no preview e conferir: sem faixas, textos grandes, ranking legível, nada cortado no meio.

## Detalhes técnicos

- Arquivo único: `src/components/oferta-ativa-ao-vivo/PlacarTv.tsx`.
- `stageScale = (window.innerWidth / 1920) * scaleAdjust`; wrapper `fixed inset-0 overflow-hidden`, palco centralizado com `translate(-50%,-50%)`.
- Substituir todos os `clamp(...vw...)` por px.
- Nenhuma mudança em dados, RPC (`rpc_placar_mutirao`) ou pontuação.
