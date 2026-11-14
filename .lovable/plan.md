# Negócios — organização e acabamento visual aprovados

## Objetivo
Aplicar na aba **Negócios do Pipeline oficial** os desenhos aprovados para computador e celular, nos temas claro e escuro. Melhorar leitura e fluidez sem redesenhar novamente nem alterar regras comerciais.

## Limites
- Os cartões de **Leads permanecem como estão**, com última atividade; os atalhos de tarefa continuam no topo.
- Não alterar etapas, distribuição, permissões, Roleta, tarefas, confirmação de venda ou dados existentes.
- Nomes, valores e situações dos desenhos são ilustrativos: a tela exibirá somente informações reais disponíveis.
- Pós-Visita continua sendo preparação, não um negócio; Ganho continua separado dos negócios em andamento.

## Fase 1 — Topo e colunas
- Trazer o seletor **Meus / Equipe** para junto das abas, somente para quem já tem esse acesso, sem duplicá-lo abaixo.
- Manter busca e filtros existentes; remover a frase explicativa solta de Negócios.
- Aplicar cabeçalhos com faixa fina na cor oficial da etapa, nome, contagem e total em reais.
- No celular, manter etapas deslizáveis, destacar a etapa selecionada e mostrar seu total acima da lista.
- Preservar o menu fixo inferior e reservar espaço para o último cartão não ficar escondido.

## Fase 2 — Resumo compacto
- Mostrar **VGV em andamento**, **negócios em andamento**, **parados há mais de 7 dias** e **sem VGV informado**.
- Computador: faixa horizontal discreta. Celular: resumo compacto, sem quatro caixas grandes empurrando a lista.
- Totais acompanham busca, filtros e Meus/Equipe; excluir Pós-Visita e Ganho dos totais em andamento.
- Parados e sem VGV funcionam como atalhos removíveis; suas contagens são calculadas antes do próprio atalho, para não se apagarem ao selecionar.
- O indicador de tempo sem atividade não muda a saúde nem passa a depender de tarefa vencida; não reclassificar leads com ação futura.
- Valores ausentes ficam explícitos, sem inventar estimativas; carregamento e falha não aparecem como carteira zerada.

## Fase 3 — Cartões de Negócios
- Nome com até duas linhas, sem disputar espaço com o valor.
- Produto e valor na linha seguinte; texto longo quebra de forma controlada.
- Situação real em selo discreto, preservando parceria e avisos existentes, sem novas caixas de tarefa ou excesso de cores.
- Saúde com pequena bolinha e última atividade; não usar troca de etapa como contato realizado.
- Para Ganho, preservar a apresentação da assinatura oficial, sem inventar atividade recente.
- **Virar negócio** vira ação discreta em Pós-Visita, sempre disponível ao toque e ao teclado; mantém o formulário atual.
- Manter abertura da ficha, menu de ações e movimentações com as mesmas confirmações e salvamentos existentes.
- Colunas vazias recebem mensagem curta e específica, como **Nenhum contrato agora**.

## Fase 4 — Qualidade e validação
- Revisar cada fase antes da seguinte, comparando com os desenhos aprovados.
- Conferir computador em 1494px e celular em 390px, além de 360px e 430px para nomes longos e filtros; verificar temas claro e escuro.
- Validar ao vivo com sessão autenticada: abrir Negócios, alternar Meus/Equipe, buscar, selecionar/remover filtros, trocar etapas no celular, abrir ficha e menus, abrir formulários e cancelar.
- Conferir regressão em Leads e Equipes/Modo Time: filtros de tarefa, última atividade dos cartões e abertura da ficha permanecem iguais.
- Revisar o diff e executar os testes existentes afetados. Não declarar pronto apenas por compilar.
- Nenhum teste altera lead real. Se for necessário verificar gravação, usar somente lead de teste; em registros reais, sempre cancelar.

## Detalhes técnicos
- Reutilizar o cabeçalho oficial em `src/components/pipeline-v2/PipelineHeaderV2.tsx` e os cabeçalhos de coluna existentes. O nome da pasta não significa reabrir a página de teste.
- Compartilhar o estado de Meus/Equipe entre topo e Negócios, preservando escopos autorizados.
- Dividir `NegociosBoardInline.tsx` em apresentações focadas de cartões, resumo e colunas, mantendo as ações e formulários de jornada compartilhados.
- Usar os dados autorizados existentes e os tipos canônicos das etapas; não criar consultas paralelas para versões de celular/computador nem alterar o backend neste plano.
- Criar seletores puros compartilhados para resumo e atalhos; testar exclusão de Pós-Visita/Ganho, ausência de VGV, limite de mais de 7 dias, reconciliação com filtros e ausência de duplicação.
- Usar componentes do design system, cores semânticas e tokens de movimento; respeitar preferência por movimento reduzido.
- Se a conferência identificar divergência da fonte atual com a regra canônica, registrar a divergência e apresentar correção separada antes de mudar números ou acessos.

## Entrega
Negócios integrado visualmente ao Pipeline, mais legível e compacto no computador e no celular, sem alterar os cartões de Leads nem as regras do CRM. Construção começa somente após aprovação deste plano.