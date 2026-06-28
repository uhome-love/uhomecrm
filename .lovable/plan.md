# Pipeline Mobile — Paridade total com Desktop

Análise como diretor de produto + dev + analista-chefe do CRM. O objetivo é fazer o Pipeline funcionar 100% no celular/app como funciona no PC, em todas as visões (corretor, gestor, CEO), modernizando o visual **sem apagar nada e sem quebrar funções**.

## Diagnóstico atual (o que está prejudicando o mobile)

Após auditar `PipelineKanban.tsx`, `PipelineHeader.tsx`, `PipelineMobileView.tsx`, `PipelineLeadDetail.tsx`, `CardMinimal.tsx` e o drawer:

1. **Abas inacessíveis no mobile.** O cabeçalho mobile (`md:hidden`) só expõe Kanban. As abas `Inteligência`, `Modo Time` e `Equipes` (`roleTabs`) aparecem **apenas em tablet/desktop**. No celular, gestor e CEO ficam sem painéis de gestão — exatamente o que torna "impossível gerir pelo celular".
2. **Busca escondida.** A busca mobile é um ícone que abre um campo; funciona, mas é pouco visível e some. O usuário relata "não consigo buscar".
3. **Modal de lead apertado.** `PipelineLeadDetail` usa um `Sheet` lateral `w-full` no mobile com a coluna de info empurrada para uma aba "Info"; a `TabsList` tem 4 abas em telas estreitas (texto truncado), e a `DrawerActionGrid` (ações rápidas) fica densa.
4. **Cards sem ação rápida tátil.** No mobile só há tap (abre modal) e o `CardOverflowMenu`. Falta swipe/atalho para ações frequentes (tarefa, WhatsApp, avançar etapa).
5. **Navegação entre etapas por scroll-horizontal de tabs** — funcional, mas sem indicação de progresso nem gesto de swipe entre etapas.
6. **Filtros avançados** abrem em sheet, mas as "pílulas" de status e badges de filtro ativo ficam em barras que competem por espaço vertical escasso.

Nada disso será removido — tudo é **aditivo/refinado** atrás do breakpoint mobile.

## Princípios do plano

- **Zero regressão no desktop.** Todas as mudanças vivem em ramos `isMobile`/`md:` ou em componentes novos só montados no mobile. Componentes desktop intactos.
- **Reusar a lógica existente** (mesmos hooks `usePipeline`, `useUserRole`, mesmos handlers de filtro/sort/seleção). Só muda a camada de apresentação mobile.
- **Sem mexer em banco, RLS, edge functions.** É trabalho de frontend/apresentação.

## Fase 1 — Paridade de navegação (todas as visões)

Dar ao mobile as mesmas abas do desktop.

- Adicionar ao bloco `md:hidden` do `PipelineHeader` um seletor de abas (`roleTabs`) — Kanban / Inteligência / Modo Time / Equipes — conforme o papel (já calculado por `isAdmin`/`isGestor`). Estilo: scroll-horizontal compacto ou um seletor "segmented".
- Garantir que `PipelineKanban` renderize os conteúdos das abas (`inteligencia`, `time`, `equipes`) também no mobile (hoje o branch mobile só cobre `kanban`). Reaproveitar os mesmos componentes lazy do desktop dentro de um container mobile com scroll.
- Resultado: gestor e CEO passam a abrir Inteligência, Modo Time e Equipes pelo celular.

## Fase 2 — Busca e filtros sempre acessíveis

- Tornar a busca mobile persistente e óbvia: campo de busca fixo (ou botão grande rotulado "Buscar") no topo do Kanban mobile, em vez de ícone que abre/fecha.
- Compactar as barras de pílulas/badges num único bloco com scroll horizontal e contadores, preservando os mesmos filtros e handlers.
- Manter o sheet de filtros avançados (`PipelineAdvancedFilters`) como está, apenas garantindo toque confortável (alvos ≥ 40px).

## Fase 3 — Modal de lead "como no PC" (peça central)

Refinar `PipelineLeadDetail` no mobile:

- Modal em tela cheia com header fixo (nome, etapa, status, ações principais) e conteúdo rolável.
- Abas roláveis horizontalmente (Info / Histórico / Tarefas / Visitas) com alvos de toque maiores e contadores legíveis — sem truncar.
- `DrawerActionGrid` reorganizada como grade de ações táteis (WhatsApp, Ligar, Anotar, Nova tarefa, Agendar visita, Avançar etapa, Parceria) com ícones e rótulos.
- Barra de ação inferior fixa (sticky) com as 2–3 ações mais usadas, ao alcance do polegar.
- Garantir que TODAS as funções do desktop estejam presentes (parceria, inativar, descartar, transferir, templates WhatsApp, próxima ação) — nenhuma escondida.

## Fase 4 — Cards e gestos modernos

- Manter `CardMinimal` + `CardOverflowMenu` e adicionar, no mobile, atalhos táteis: ação rápida ao tocar em ícones do card (tarefa/WhatsApp) e, opcionalmente, swipe para "avançar etapa" / "ações".
- Indicadores visuais modernos: progresso de etapa, badges de SLA/temperatura mais legíveis, espaçamento e tipografia ajustados para densidade mobile.

## Fase 5 — Polimento visual e "feel de app"

- Padronizar tokens semânticos (sem cores hardcoded novas), cantos 12px, sombras suaves, animações de transição entre etapas/abas.
- Estados de carregamento e vazio consistentes.
- Conferir áreas de toque, contraste e dark mode em todas as telas mobile.
- Validar que a navegação inferior (`TabBar`) e o Pipeline convivem sem cobrir conteúdo.

## Validação

- Conferência visual nas 3 visões (corretor, gestor, CEO) em viewport mobile via preview.
- Checagem de tipos e build após cada fase.
- Regressão rápida no desktop para garantir nenhuma mudança de comportamento.

## Detalhes técnicos (resumo para implementação)

- Arquivos centrais: `src/pages/PipelineKanban.tsx` (branch mobile das abas), `src/components/pipeline/PipelineHeader.tsx` (bloco `md:hidden`), `src/components/pipeline/PipelineMobileView.tsx`, `src/components/pipeline/PipelineLeadDetail.tsx` + `drawer/*`, `src/components/pipeline/CardMinimal.tsx`.
- Toda lógica de dados permanece em `usePipeline` e hooks existentes; mudanças são de apresentação/condicionais `isMobile`.
- Sem migrations, sem alteração de RLS/edge functions, sem remoção de componentes ou props.

## Como prefere priorizar?

Posso entregar tudo de uma vez ou em ondas. Sugiro começar pela **Fase 1 (abas no mobile)** + **Fase 3 (modal de lead)**, que são as que mais destravam a gestão pelo celular, e seguir para as demais. Me diga se quer assim ou outra ordem.
