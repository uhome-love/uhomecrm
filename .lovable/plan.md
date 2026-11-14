# Pipeline teste (/pipeline-v2) — meio-termo entre beleza, qualidade e modernidade

Tudo acontece só na página de teste. O Pipeline de hoje continua igual para todos, e nenhuma regra muda: etapas, saúde, Roleta e quem é dono do lead ficam como estão.

## Direção
Um quadro calmo e "premium leve": menos ruído, mais clientes visíveis e cada ação com continuidade. Sem outro redesign. A ideia é refinar o que já foi aprovado.

## Fase 0 — Desenho para aprovação (antes de qualquer construção)
Mockup do computador (1494px) e do celular (390px), no tema claro e no escuro, mostrando as mudanças abaixo. Só sigo depois do teu ok.

## Fase 1 — Consistência (prioridade)
- O cartão passa a considerar ação futura (visita ou tarefa marcada): quem tem ação futura nunca aparece como desatualizado. É a mesma regra do Pipeline atual.
- No cartão, "Ligar" segue o mesmo fluxo da ficha: abre o discador e, quando o corretor volta ao app, aparece a tela de resultado.

## Fase 2 — Topo mais leve
- **Computador:** uma linha só, com busca, etapa/visão, atalhos (Atrasadas · Hoje · Sem ação) e um botão "Mais", que reúne filtros, ordenar e exportar.
- **Celular:** busca e seletor de etapa ficam fixos. Os indicadores se recolhem numa faixa fina ao rolar, para o primeiro cliente aparecer logo na metade de cima da tela.
- Saúde com rótulos claros: "Em dia 12 · Atenção 5 · Desatualizado 3", em vez de pontos soltos.

## Fase 3 — Acabamento dos cartões
- Nome com até 2 linhas e produto em 1 linha com "…", com o texto completo ao tocar ou passar o mouse.
- As ações rápidas ficam numa faixa própria no rodapé do cartão e nunca cobrem nome ou valor.
- Hierarquia: nome forte, próxima ação com data colorida só quando atrasada ou hoje, e o resto em tom neutro.
- Sombra e borda suaves, cantos de 12px, e destaque sutil ao arrastar.
- Colunas com cabeçalho fixo durante a rolagem, mostrando contagem e VGV da etapa.

## Fase 4 — Toque moderno, sem exagero
- Transições curtas ao abrir filtros e mover cartão, respeitando quem desativa animações no aparelho.
- Estado vazio amigável por coluna, como "Nenhum cliente aqui".
- O tema escuro é revisado com o mesmo cuidado do claro.

## Validação (em cada fase)
- Computador e celular de 390px, nos temas claro e escuro, com prints.
- Gravações testadas só com lead de teste, que depois é apagado: arrastar, ligar e registrar.
- Visão de corretor, se indicares qual conta usar.

## Detalhes técnicos
- Arquivos: `PipelineKanbanV2.tsx`, `PipelineHeaderV2.tsx`, `CardPipelineV2.tsx`, `PipelineBoardV2.tsx` e `PipelineMobileViewV2.tsx`.
- A saúde usa o `tem_acao_futura` já fornecido pela RPC `leads_com_acao_futura`, e o fluxo de ligação reaproveita a lógica de retorno do discador de `PipelineLeadDetail`. Nada muda no banco de dados.
- Uso só os tokens do design system, sem cores fixas. Se algum arquivo passar de 300 linhas, divido em partes menores.
