
# Fase 1 — Drawer Universal do PDN

Hoje a Planilha edita tudo inline e o Kanban abre um `PdnCardDrawer` com "Publicar no lead". Isso quebra a paridade: ações-chave (publicar, avisar, timeline, mudar etapa) só existem em um dos lados. A Fase 1 resolve isso trocando os dois pontos de entrada por um único drawer com 3 abas.

## Objetivo

Um único ponto de verdade para "editar um negócio no PDN", chamado tanto pela Planilha (clique no nome/linha) quanto pelo Kanban (clique no card). Todas as ações — publicar no lead, avisar corretor, mudar etapa PDN, editar VGV/observação, ver o histórico do lead — ficam disponíveis em qualquer view.

## O que muda na UI

Drawer lateral (Sheet 480px desktop, full mobile), com header + 3 abas:

- **Contexto** — dados de leitura do lead + timeline. Nome, corretor, equipe, data, atalho "Abrir lead no pipeline", e a última janela de eventos vinda de `v_lead_timeline` (últimos 15). Para linhas manuais (`isManual`), a aba mostra só um aviso "negócio manual — sem lead no pipeline".
- **Ação** — o que hoje já está no `PdnCardDrawer`: Status, Prioridade, Próxima ação + data, Observação interna, com os botões "Publicar no lead" idempotentes (SHA-1 marker). Para linhas manuais, os botões de publicar somem.
- **Etapa** — seletor de etapa PDN + "voltar à etapa do pipeline", editor de Empreendimento/VGV (overlay do gestor), bloco "Avisar corretor", risco manual + motivo, e ações destrutivas (Queda / Reativar / Remover da planilha) no rodapé.

Ícone/menu na Planilha: a coluna "Nome" vira clicável (abre drawer). Os ícones da direita (avisar/queda/remover) continuam como atalho rápido sem abrir o drawer. No Kanban, o clique no card continua abrindo o drawer (comportamento atual).

## Escopo técnico

### Arquivos novos

- `src/components/pdn/drawer/PdnLeadDrawer.tsx` — orquestrador. Recebe `row`, `onClose`, e os mesmos handlers que o `PdnCardDrawer` recebe hoje. Renderiza header + Tabs.
- `src/components/pdn/drawer/PdnTabContexto.tsx` — timeline via `v_lead_timeline` (query direta filtrando `pipeline_lead_id`), reaproveita `DrawerTimelineGroup` de `src/components/pipeline/drawer/`.
- `src/components/pdn/drawer/PdnTabAcao.tsx` — status, prioridade, próxima ação, observação + `PublishButton`. Extrai o `PublishButton` e `sha1Short` para um helper compartilhado `src/components/pdn/drawer/publish.ts`.
- `src/components/pdn/drawer/PdnTabEtapa.tsx` — etapa PDN, empreendimento/VGV, avisar corretor, risco manual, ações destrutivas.

### Arquivos alterados

- `src/components/pdn/PdnKanban.tsx` — troca `PdnCardDrawer` por `PdnLeadDrawer`. Sem outra mudança.
- `src/pages/PdnGestor.tsx` — a Planilha ganha `selectedRow` state e passa `onOpenRow` para `PdnPlanilha` (subcomponente já interno ao arquivo). Clique no nome dispara o drawer. Renderiza `PdnLeadDrawer` no fim.
- `src/components/pdn/PdnCardDrawer.tsx` — deletado (`rm`). Toda a lógica migra pra `PdnLeadDrawer` e as 3 tabs.

### Contrato de dados

- Timeline vem de `v_lead_timeline` (view canônica já existente, usada no lead drawer do pipeline). Filtro por `pipeline_lead_id`, limit 15, ordem DESC. Se a view não expor os campos esperados (`id`, `tipo`, `title`, `description`, `date`), a aba mostra fallback "sem eventos".
- "Publicar no lead" continua idempotente por SHA-1 curto em `pipeline_anotacoes.conteudo` com marker `[pdn:<leadId>:<field>:<hash>]`. Nada muda no backend.
- Sem migração de banco nesta fase.

### Comportamentos preservados

- Edição de VGV/empreendimento continua sendo overlay (não altera o pipeline do corretor).
- Ícones de ação rápida na direita da linha da Planilha continuam funcionando sem abrir drawer.
- Mudança de etapa no PDN continua sendo local (não move o lead no pipeline).
- Salvamento continua otimista via `onSave` / `onUpdateManual` como hoje.

## Fora do escopo (fica pra fases seguintes)

- Fase 2: edição inline em mais campos, seleção múltipla, bulk actions, colunas configuráveis.
- Fase 3: ações rápidas no hover do card do Kanban e preview horizontal de impacto.
- Fase 4: criar tarefa no pipeline do corretor a partir do PDN.

## Validação antes de fechar

1. Typecheck limpo + `bunx vitest run` verde.
2. Playwright em `/pdn`: clicar num nome na Planilha abre o drawer; alternar Planilha↔Kanban e clicar num card abre o mesmo drawer; navegar entre as 3 abas; publicar uma observação e ver o botão virar "Publicado ✓"; recarregar e o estado "Publicado ✓" persistir; em lead manual, aba Contexto mostra o aviso e a aba Ação esconde os botões de publicar.
3. Smoke em 440px: drawer full-width, tabs legíveis, sem overflow.

## Riscos / mitigação

- Perda de estado ao trocar de aba enquanto edita: o form vive no `PdnLeadDrawer`, tabs só trocam qual bloco fica visível. Sem desmontar campos.
- Timeline lenta em leads com muitos eventos: limit 15 + skeleton.
- Regressão no Kanban: teste manual do fluxo drag-drop de etapa continua igual (drawer não toca em drag).

Aprovando esse escopo, sigo pro build.
