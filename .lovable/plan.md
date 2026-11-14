# Etapa "Atendimento", próxima tarefa no cartão, pop-up compacto, auditoria do Pipeline e fim da página de teste

## 1. A etapa "Qualificação" passa a se chamar "Atendimento"
- Todos os lugares que mostram o nome da etapa passam a mostrar "Atendimento": coluna do Pipeline, celular, ficha do lead, filtros, mudança de etapa, Negócios, relatórios, Leads estagnados, Oferta Ativa (listas), mensagens de WhatsApp por etapa, Homi e painéis.
- "Qualificação" vira um **sub status** dentro de Atendimento. A lista fica: Contato inicial, Qualificação, Alinhando perfil, Busca de imóveis, Follow up, Alinhando visita.
- Os leads continuam na mesma etapa: nada se move, e regras, tarefas automáticas, a Roleta e as contagens continuam iguais. Só o nome muda.

## 2. O cartão mostra a próxima tarefa no lugar de "última atividade"
- Se o lead tem tarefa: "Próxima: Follow-up · amanhã 10h". Fica vermelho quando está atrasada e azul quando é para hoje.
- Se não tem tarefa: "Sem próxima ação", em amarelo. São os mesmos nomes e cores dos atalhos de tarefa do topo.
- O restante do cartão continua igual, no computador e no celular.

## 3. Pop-up "Concluir tarefa" compacto (desenho aprovado)
- Cabeçalho em uma linha; resultado e observação em cima; status em uma linha; próxima ação com botões rápidos e atalhos de data; o resto fica em "Mais opções".
- Rodapé com os botões sempre visíveis. No celular ele aparece como uma folha que sobe de baixo, com no máximo 85% da altura.
- As regras e a gravação continuam as mesmas.

## 4. Fim da página de teste do Pipeline
- Sai a página de teste e os arquivos que só ela usava. O que foi aproveitado (topo, colunas, filtros) continua no Pipeline oficial.

## 5. Auditoria de qualidade do Pipeline (computador e celular)
- Conferir as contagens: topo, colunas, atalhos e saúde batendo entre si.
- Conferir os filtros e a combinação entre eles, a busca, Meus/Empresa, a troca de abas, arrastar cartão, a ficha, as ações rápidas, o tema escuro e o tempo de carregamento.
- No celular em 390px: topo, atalhos, troca de etapa, cartões, pop-up e menu fixo embaixo.
- O que estiver quebrado e for pequeno eu corrijo na hora. O que for maior entra numa lista para você decidir.
- Os testes usam só lead de teste e sempre terminam em Cancelar.

## Ordem
1. Nome da etapa e sub status, depois validação.
2. Cartão com a próxima tarefa.
3. Pop-up compacto.
4. Remoção da página de teste.
5. Auditoria, com relatório e correções pequenas.

## Detalhes técnicos
- No banco: `pipeline_stages.nome` passa de 'Qualificação' para 'Atendimento' (tipo `qualificacao` mantido), e a função `get_ranking_gestao_leads`, que compara pelo nome, é ajustada. É uma migração pequena, fora do horário comercial ou dentro do limite do dia.
- No código: dicionários indexados por nome (`celebrations.ts`, `PipelineBoard` themes, `stageToCategoria.ts`, `CustomListWizard` find por nome, `whatsappMensagens`, `CallFocusOverlay`, `NegociosBoardInline`, `LiaKanbanTab`, `pipelineEtapas.ts`, Homi edge functions) passam a usar "Atendimento". Onde a busca é por nome, aceitar também o nome antigo.
- Sub status: novo valor `qualificacao` em `status_atendimento` (map em `leadHelpers.ts`, opções em `LeadFlagControls`/`CompletionForm`/`stageViewPrefs`).
- Cartão: `CardMinimal` recebe `proximaTarefa` (já vem de `kanbanTarefasMap`) e usa os textos de `pipelineV2/proximaAcao`.
- Pop-up: `CompletionForm.tsx` dividido (próxima ação em componente próprio, avançado recolhível).
- Remover: rota `/pipeline-v2`, `PipelineKanbanV2`, `PipelineBoardV2`, `PipelineMobileViewV2`, `CardPipelineV2`, `MobileTopoV2`, `useSwipeEtapa` e `pipelineV2/swipe`, desde que nada mais os use. Ficam `PipelineHeaderV2`, `ColunaCabecalhoV2` e `proximaAcao`.
- Atualizar testes (`pipelineEtapas.test.ts`, `CaminhoDoLead.test.ts`) e a memória da regra das 10 etapas.
