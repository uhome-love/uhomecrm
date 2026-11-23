# Conferir e corrigir os filtros do Pipeline (Filtros Avançados)

## O que já conferi
- O filtro "Dias sem ação" conta os dias desde a última ação registrada no lead (ou desde a última troca de etapa).
- Nos dados existem leads para todas as opções (ex.: 604 leads parados há mais de 7 dias, 101 há mais de 30 dias).
- Suspeita principal (ainda não confirmada na tela): o quadro do Pipeline esconde os leads "estagnados" (eles vivem só na página Leads estagnados). Como quase todo lead parado há 15/30 dias é estagnado, as opções maiores ficam vazias ou quase vazias, e parece que o filtro não funciona.

## Fase 1 — Testar cada filtro ao vivo (sem mudar nada)
Entrar no Pipeline (computador e celular 390px) e testar um por um, anotando quantos leads aparecem e se bate com os dados:
Origem, Segmento, Empreendimento, Dias sem ação, Período de entrada (inclusive Personalizado), Visita marcada, Status do lead, Gerente, Temperatura, Etapa e Corretor. Também conferir se os chips do topo e o "limpar" funcionam.

## Fase 2 — Mostrar o resultado e propor a correção
Te mando a lista: quais filtros funcionam, quais não e o porquê. Para o "Dias sem ação", a correção provável é: quando esse filtro estiver ligado, mostrar também os leads estagnados (com o selo deles), para o número bater. Nada é corrigido antes de você aprovar.

## Fase 3 — Corrigir e validar
Corrigir só o que estiver quebrado, sem mudar regras de distribuição, saúde do lead ou etapas. Validar de novo no computador e no celular.

## Detalhes técnicos
- Lógica em `applyFilters` (PipelineAdvancedFilters.tsx); usa `ultima_acao_at || stage_changed_at`.
- Em PipelineKanban.tsx, `preFilteredLeads` remove `leadSaude === "estagnado"` depois dos filtros.
- Somente leitura na Fase 1; nenhum lead real é alterado.
