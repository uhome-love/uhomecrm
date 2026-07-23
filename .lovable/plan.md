Plano: Reorganização do Hub de Materiais — Marketplace com Sidebar

Objetivo
--------
Transformar a página `/materiais` de uma lista vertical de cards enormes em uma experiência de marketplace moderna: **sidebar fixo à esquerda com todos os empreendimentos**, **área principal direita mostrando apenas os materiais do empreendimento selecionado**, mantendo a pré-visualização em modal central como está hoje.

Motivo
------
O card atual exibe logo, nome, grid de 4 colunas e footer de ações para cada empreendimento. Com 9+ empreendimentos a página fica longa e cansativa. Com 20+ fica impraticável. A navegação por sidebar resolve isso porque:
- O corretor vê todos os empreendimentos numa coluna compacta.
- Clica em um empreendimento e o painel direito carrega seus materiais.
- O header e a busca da lista ficam sempre acessíveis.

Decisões já alinhadas com o usuário
-----------------------------------
- Visualização dos materiais: **área principal fixa** (painel direito).
- Pré-visualização do material: **manter modal central** (imagem/vídeo/PDF/áudio).
- Layout principal: **sidebar fixa** (recomendado como o formato mais adequado para marketplace moderno com muitos empreendimentos).

O que será feito
----------------

### 1. Novo layout de página (`MateriaisPage.tsx`)
- Substituir a pilha vertical de `MaterialCard` por uma estrutura de duas colunas:
  - **Sidebar esquerda** (~280-320px, responsivo): lista scrollável de empreendimentos.
  - **Área principal direita** (flex-1): mostra o empreendimento selecionado.
- Usar o componente shadcn `Sidebar` já existente em `src/components/ui/sidebar.tsx`.
- Adicionar `SidebarProvider` e `SidebarTrigger` no header local da página (sem alterar o layout global do app).
- Em mobile (< md), a sidebar vira um **drawer deslizante** ou botão de filtro, abrindo por cima da área principal.

### 2. Sidebar de empreendimentos (novo componente)
Criar `src/components/materiais/MateriaisSidebar.tsx`:
- Lista cada empreendimento como item de menu com:
  - Logo quadrada (40x40) com fallback em ícone `Building2`.
  - Nome do empreendimento (truncado se necessário, mas com tooltip/title completo).
  - Badge com a contagem de materiais.
  - Indicador de favorito (⭐) se o empreendimento está nos favoritos do corretor.
- Search/filter dentro da sidebar para filtrar por nome.
- Estado ativo destacado (primary color ou background muted).
- Scroll independente da sidebar para não perder a lista ao rolar materiais.
- Favoritos podem aparecer fixos no topo, depois a lista completa (ou abas dentro da sidebar: Todos / Favoritos / Recentes).

### 3. Área principal de empreendimento selecionado
Criar `src/components/materiais/MateriaisEmpreendimentoPanel.tsx` (ou refatorar `MaterialCard` para esse papel):
- Header do painel:
  - Logo grande + nome do empreendimento.
  - Badge de contagem + botão de favoritar.
  - Ações de gestão (editar, adicionar material, adicionar link, excluir empreendimento) — visíveis apenas para gestores.
- Grid de materiais: manter o `MaterialItem` atual, com thumbnail, categoria, título, ações (Copiar, Download/Abrir, Follow-up IA).
- Footer do painel:
  - "Copiar todos os links".
  - "Gerar follow-up com IA" (considerando todos os materiais do empreendimento).
- Empty state: se o empreendimento selecionado não tiver materiais, mostrar ilustração e CTA.

### 4. Estado de seleção
- Selecionar automaticamente o primeiro empreendimento ao carregar a página.
- Persistir o empreendimento selecionado na URL como query param `?emp=ID`, permitindo compartilhar link direto para um empreendimento.
- Sincronizar a sidebar com o param da URL: ao abrir `/materiais?emp=XYZ`, o painel direito já abre nesse empreendimento.

### 5. Abas Todos / Favoritos / Recentes
- As abas atuais viram filtros da sidebar ou seletor no topo da página:
  - "Todos" → lista todos os empreendimentos na sidebar.
  - "Favoritos" → sidebar mostra apenas empreendimentos favoritos.
  - "Recentes" → painel direito mostra uma lista compacta de materiais recentes (sem sidebar, ou sidebar com uma lista fixa de recentes por empreendimento).
- A aba "Recentes" pode ficar como uma visão especial sem sidebar, exibindo `MaterialListaCompact` em tela cheia.

### 6. Pré-visualização
- Não alterar o fluxo atual: `MaterialPreviewDialog` continua abrindo em modal central via `materiais-signed-read`.
- Thumbnail continua sendo carregada com URL assinada no `MaterialItem`.

### 7. Mobile e responsivo
- Desktop: sidebar fixa à esquerda, painel à direita.
- Tablet: sidebar colapsável (shadcn `collapsible="icon"`), mostrando só logos; expandir mostra nome.
- Mobile: sidebar escondida, botão "Empreendimentos" abre drawer/bottom sheet com a lista.
- Grid de materiais: 1 coluna em mobile, 2 em tablet, 3-4 em desktop.

### 8. Analytics e outros ajustes
- `MateriaisAnalytics.tsx`: continua funcionando normalmente, sem impacto estrutural.
- Remover ações duplicadas: se a sidebar tiver favorito, mantê-lo também no header do painel para clareza.
- Garantir que a busca textual continue buscando por empreendimento e material.
- A busca com IA (`materiais-search`) pode continuar listando resultados em uma seção especial, ou abrir o empreendimento do primeiro resultado.

Arquivos afetados
-----------------
- `src/pages/MateriaisPage.tsx` — reestruturação principal.
- `src/components/materiais/MaterialCard.tsx` — refatorar para `MateriaisEmpreendimentoPanel` ou reduzir a área principal.
- `src/components/materiais/MaterialItem.tsx` — sem mudanças estruturais, apenas ajustes de grid responsivo.
- `src/components/materiais/MaterialPreviewDialog.tsx` — sem mudanças.
- `src/components/materiais/MaterialListaCompact.tsx` — ajuste para aba Recentes.
- Novo `src/components/materiais/MateriaisSidebar.tsx`.
- Possível novo `src/components/materiais/MateriaisEmpreendimentoPanel.tsx`.
- `src/hooks/useMateriais.tsx` — sem mudanças.
- `src/hooks/useMateriaisFavoritos.ts` — sem mudanças.

Mockup
------
```text
┌──────────────────────────────────────────────────────────────┐
│  Materiais              [Novo empreendimento] [Analytics]      │
├───────────────┬──────────────────────────────────────────────┤
│  🔍 Buscar    │  [Logo] Casa Tua          ⭐  [Editar] [⋮]    │
│               │  7 materiais                                 │
│  ⭐ Favoritos  │                                              │
│  ─────────────┤  ┌────────┐ ┌────────┐ ┌────────┐           │
│  [Logo] Casa  │  │Drive   │ │Fotos   │ │Book    │ ...        │
│  Tua     (7)  │  │Copiar ✓│ │Copiar ✓│ │Copiar ✓│            │
│  [Logo] Casa  │  └────────┘ └────────┘ └────────┘           │
│  Verde  (12)  │                                              │
│  [Logo] Lake  │  [Copiar todos] [✨ Follow-up IA] [+]       │
│  Baikal  (3)  │                                              │
│               │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

Critérios de pronto
-------------------
- [ ] Sidebar lista todos os empreendimentos com logo + nome + contagem.
- [ ] Clicar em um empreendimento carrega seus materiais no painel direito.
- [ ] URL reflete o empreendimento selecionado (`?emp=ID`).
- [ ] Preview de material continua funcionando em modal central.
- [ ] Mobile: navegação de empreendimentos via drawer/bottom sheet acessível.
- [ ] Favoritos, Recentes e Busca com IA funcionam no novo layout.
- [ ] Typecheck e build passam sem erros.
- [ ] Validação ao vivo no preview.