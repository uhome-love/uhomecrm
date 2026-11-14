# Pipeline v2 — página de teste em /pipeline-v2 (PROMPT-1)

Só visual, sem banco. O `/pipeline` atual não muda. Mockup já aprovado (imagens da pasta `referencia/` do pacote).

## O que você vai ver
- Endereço novo `/pipeline-v2` (fora do menu, sem restrição de papel para testar com corretor).
- Cartão novo (quem · o quê · próxima ação colorida com botão · rodapé de saúde), topo em 3 linhas com atalhos "Tarefa atrasada / Para hoje / Sem próxima ação" e saúde agrupada.
- Celular: "Seu dia", etapa recolhida presa no topo com grade 3×2, setas e arrasto lateral, lista carregando sozinha até o fim (sem "Mostrar mais"), sem barra de rolagem lateral.

## Arquivos novos (copiados do pacote, ajustados ao código atual)
- `src/lib/pipelineV2/textos.ts`, `proximaAcao.ts`, `swipe.ts`, `__tests__/pipelineV2.test.ts`
- `src/components/pipeline-v2/CardPipelineV2.tsx`, `PipelineHeaderV2.tsx`, `ColunaCabecalhoV2.tsx`, `MobileTopoV2.tsx`, `useSwipeEtapa.ts`

## Cópias com trocas pontuais
- `src/pages/PipelineKanbanV2.tsx` (de `PipelineKanban.tsx`): HeaderV2, estado `acaoFilter`, `acaoCounts`, `filtrarPorAcao` no fim do filtro, "Limpar tudo" zera, BoardV2 e MobileViewV2. Negócios, Equipes, Modo Time, ficha, Foco, seleção em massa e Fila CEO iguais.
- `src/components/pipeline/PipelineBoardV2.tsx` (de `PipelineBoard.tsx`): CardPipelineV2, `ColunaCabecalhoV2` com ordenação/limpar descartados como filhos, `colunaEstiloV2`, emoji/cor pelo tipo da etapa e `pipeline_stages.cor`, mantém `PipelineCardHover` e `VirtualizedCardList` (todas as leads, topo da coluna fixo).
- `src/components/pipeline/PipelineMobileViewV2.tsx` (de `PipelineMobileView.tsx`): MobileTopoV2 dentro do contêiner que rola, card `variante="toque"`, sem fonte Plus Jakarta, busca do mapa de cadência (só leitura) para "Tentativa N de 7", `useSwipeEtapa`, carregamento automático de 20 em 20, volta ao topo ao trocar de etapa.

## Rota
`src/config/pageRegistry.ts`: chave `pipeline-v2` e entrada `/pipeline-v2` "Pipeline (novo)".

## Não muda
Nenhuma migration, regra de acesso, gatilho, cron ou função de servidor. Arquivos antigos (`PipelineKanban`, `PipelineBoard`, `PipelineMobileView`, `CardMinimal`, `PipelineHeader`) intocados. Botões do card só reaproveitam fluxos existentes (registro de atividade, conclusão de tarefa, menu ···, abrir ficha).

## Pontos que você pediu para eu avisar
- Gestos no celular: a tela atual do celular não tem segurar-para-mover nem puxar-para-atualizar; só rolagem. O arrasto lateral entra sem conflito; o gesto só troca de etapa quando o movimento é claramente horizontal, e um arrasto não abre a ficha.
- `PipelineCardHover`: será mantido; se os botões ⚡/··· do canto conflitarem com o balão ao passar o mouse, afasto o balão desses botões (sem mudar o balão em si) e aviso.
- Tamanho de arquivo: as cópias de `PipelineKanban` (985 linhas) e `PipelineBoard` (1244) já passam do limite da casa. Para não piorar, as partes novas ficam nos arquivos V2 separados; a divisão das cópias fica para a rodada da troca (PROMPT-2), quando a antiga sair.
- Outros usos do cartão/topo antigos (ficam para outra rodada): `NegociosBoardInline`, `CardOverflowMenu`, `PipelineCorretorSelect`, `leadHelpers`, `completeLeadTask`.

## Validação depois de construir
1. Rodar os 45 testes do pacote.
2. Comparar `/pipeline` e `/pipeline-v2` lado a lado: mesmas colunas e números.
3. Playwright em 1280px e 390px, claro e escuro, com lead de teste: atalhos filtram e "Limpar tudo" zera; WhatsApp, Ligar (popover no computador), ✓ Confirmar, "Definir agora", "Tentativa N de 7"; arrastar card entre colunas; celular sem rolagem lateral, grade abre/fecha, setas e arrasto trocam de etapa.
4. Entrar como corretor de teste (você escolhe qual) para conferir que não vê o próprio nome, Equipes nem seletor de corretor.
5. Prints de computador e celular para você.
