# Revisão visual premium do Pipeline (sem mudar regras)

Escopo: só a aparência e a facilidade de uso do Pipeline. As 10 etapas, os filtros, o arrastar, as permissões, a estagnação, as visitas, as parcerias e todas as contas seguem exatamente como hoje. Nada muda no banco.

Seguindo o padrão Lucas: desenho primeiro, aprovação, depois construção em fases pequenas, cada uma conferida no computador e no celular (390px) antes da próxima.

## Fase 0 — Desenhos para aprovação (antes de qualquer código)
Desenhos de alta fidelidade (computador + celular) de:
1. Topo do Pipeline: título com total, Ganhos, Modo Foco, Novo Lead numa linha baixa; seletor único "Equipes | Leads | Negócios"; Empresa/Meus Leads como filtro mais discreto.
2. Saúde do Pipeline: "Em dia / Atenção / Críticos" com nome e explicação ao passar o mouse.
3. Barra de filtros unificada (Buscar, Corretor, Gestor, + Filtros) e filtros ativos como etiquetas removíveis com "Limpar".
4. Faixa de ganhos/negócios mais baixa e elegante.
5. Trilha das etapas compacta com agrupamento sutil (Entrada, Relacionamento, Experiência, Negócio, Resultado), etapa visível destacada, clique leva à coluna, setas e sombras laterais.
6. Cabeçalho de coluna menor (nome + quantidade; valor e média abaixo), sem repetir a trilha.
7. Cartão do lead: nome, empreendimento, temperatura/situação (no máximo 2 selos, resto ao passar o mouse), "há 12 dias sem atividade" com cor de atenção, corretor, próxima ação só quando relevante; barra lateral só para saúde (verde/âmbar/vermelho); ações rápidas (WhatsApp, Ligar, Abrir) ao passar o mouse; cartão fica marcado enquanto a ficha está aberta.
8. Ficha do lead: cabeçalho como bloco único, WhatsApp/Ligar/Registrar com o mesmo peso, Próxima ação em destaque, histórico com mais espaço e menos caixas.

Você aprova ou ajusta os desenhos. Só então segue.

## Fases de construção (uma por vez, cada uma validada)
- Fase 1: topo, seletor de visões, saúde e faixa de ganhos.
- Fase 2: filtros unificados e etiquetas.
- Fase 3: trilha das etapas, rolagem lateral e cabeçalhos de coluna.
- Fase 4: cartão do lead (selos, atividade, hover, selecionado).
- Fase 5: ficha do lead (cabeçalho, ações, próxima ação, histórico, tarefas, visitas).
- Fase 6: Negócios, Ganhos, Modo Foco e Homi no mesmo acabamento.
- Fase 7: celular 390px, movimentos suaves (respeitando "reduzir movimento"), acessibilidade e velocidade com muitos cartões.

Cada fase: conferir ao vivo com lead de teste (sempre Cancelar), sem alterar leads reais, e garantir que as outras telas não quebraram.

## Detalhes técnicos
- Arquivos principais: `PipelineHeader`, `header/*`, `PipelineBoard`, `CardMinimal`, `PipelineCardHover`, `LeadFlagBadges`, `TemperaturaChip`, `PipelineFiltroBadges`, `PipelineAdvancedFilters`, `PipelineLeadDetail` + `drawer/*`, `NegociosBoardInline`, `PipelineMobileView`.
- Somente tokens do design system v4 (`--primary`, `--brand`, shell-*, motion tokens); sem cores fixas.
- Contagens continuam vindo das mesmas fontes atuais (`useEquipesView`, `v_negocios_pipeline`); nenhuma consulta ou regra nova.
- Arquivos acima de 300/500 linhas que forem tocados são divididos em partes menores sem mudar comportamento.
