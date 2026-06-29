# Reorganização visual do header do Pipeline (desktop)

Você escolheu a direção **Command deck segmentado (v3)**. O objetivo é puramente visual/organizacional: agrupar os controles em clusters limpos, com divisores e espaçamento consistente, para o header parecer um produto SaaS de alto nível. **Nenhuma função é removida** — apenas reorganizada e restilizada.

Escopo: somente o bloco desktop (`lg+`) de `src/components/pipeline/PipelineHeader.tsx`. O header mobile e toda a lógica (estado, handlers, contadores) permanecem intactos.

## O que muda visualmente

### Linha 1 — Identidade · Navegação · Status
```text
[ ▣ Pipeline  ·  79 leads  ·  «escopo» ]   [ Equipes | Kanban | Inteligência ]            [● 1.350 │ ● 295 │ ● 576 │ ● 70]
```
- **Identidade**: mantém ícone + "Pipeline" + contador de leads + badge de escopo, agrupados com baseline alinhada.
- **Navegação (abas)**: passa a ser um **segmented control** dentro de um container `bg-muted` com borda e `p-1` (aba ativa em card branco com sombra sutil), em vez de botões soltos. Os toggles Equipe/Minha carteira e Funil/Radar continuam ao lado.
- **Pílulas de status**: viram um **cluster unido** (botões encostados com `-space-x-px` e bordas compartilhadas, cantos arredondados só nas pontas), em vez de pílulas separadas flutuando. Mantém o modo `compact` e o comportamento de filtro atual.
- As ações primárias (Modo Foco, Novo Lead) continuam alinhadas à direita da linha 1.

### Linha 2 — Filtros · Busca · Ordenação · Ações globais
```text
[ 🔍 Buscar... ] │ [ Corretores ▾ ] [ Gestores ▾ ] [ + Filtros ]      «Ordenar por» Atividade ▾  │  [ Fila CEO ⦿14 ]  [ ⋯ ]
```
- **Busca** vai para a esquerda, com divisor vertical separando-a do grupo de filtros.
- **Filtros** (Corretores, Gestores, +Filtros) ficam agrupados como cluster coeso à esquerda.
- **Ordenação** ganha rótulo discreto "Ordenar por" + valor, seguido de divisor.
- **Fila CEO** e o menu **⋯** ficam agrupados à direita como ações globais.
- Alturas (`h-9`), raios (`rounded-lg`) e cores via tokens semânticos unificados em todos os controles.

## Notas técnicas
- Edição única em `src/components/pipeline/PipelineHeader.tsx`, bloco `hidden lg:block` (linhas ~519–792).
- Reaproveita componentes existentes (`PipelineCorretorSelect`, `PipelineGestorSelect`, `PipelineAdvancedFilters`, `PipelineSortDropdown`, `PipelineFiltroBadges`, `PipelineScopeBadge`, Popover da Fila CEO, DropdownMenu ⋯). Pequenos ajustes de classe nesses subcomponentes só se necessário para alinhamento (sem mudar comportamento).
- Cores convertidas para tokens semânticos do design system (sem hardcode de `bg-white`/`text-slate-*` novos); o protótipo usa slate/indigo apenas como referência visual.
- Mantém `flex-wrap` para degradar bem de 1280px a 1920px.
- Validação: `tsgo` limpo + screenshots multi-largura (1280/1440/1702/1920) confirmando que nada quebrou e os grupos ficam alinhados.

Resultado: mesmo conjunto de funções, agora visualmente organizado em grupos claros com divisores e espaçamento consistente.