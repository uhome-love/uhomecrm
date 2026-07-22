# PDN Unificado — Plano de 8 fases (aprovado)

Objetivo: fazer Planilha (Desktop) e Kanban (Mobile) do PDN "falarem a mesma língua", com paridade total de funções e integração real com o histórico do lead.

## Fase 1 — Drawer único e universal (`PdnLeadDrawer`)
Substitui o drawer antigo com 3 abas:
- **Contexto do lead:** cabeçalho rico com timeline via `v_lead_timeline`, última observação do corretor, próxima tarefa dele.
- **Ação do gestor:** observação, prioridade, risco, VGV — cada bloco com botão "Publicar no lead" idempotente por hash SHA-1.
- **Etapa:** mover entre grupos do PDN, marcar queda, reativar.

Planilha e Kanban chamam o mesmo drawer. Preserva estado ao salvar.

## Fase 2 — Planilha nível SaaS
- Linha inteira clicável abre drawer.
- Ícones de ação por linha (publicar, marcar queda) no hover.
- Colunas configuráveis via menu, preferência por device.
- Seleção múltipla + barra de ação em lote ("Publicar observação no lead em massa").
- Ordenação por header, densidade compacta, zebra sutil.

## Fase 3 — Kanban nível SaaS
- Botões rápidos no hover do card (publicar, avisar, marcar queda).
- Badge "publicado há Xh".
- Drag com preview de impacto.
- Colunas colapsáveis, contador de pendentes de publicar.

## Fase 4 — Integração bidirecional
- Publicação em lote com `origem_ref` idempotente.
- `pipeline_tarefas` com `origem='pdn'` quando a ação tem data.
- "Avisar corretor" unifica notificação + publicação.
- Link de volta do lead pro PDN.

## Fase 5 — Toolbar unificada
- Barra de busca (`⌘K` estilo) dentro do PDN.
- Filtros como chips arredondados.
- Toggle Planilha/Kanban persistido por role.
- "Copiar resumo pro WhatsApp".

## Fase 6 — Quebra de arquivo
- `PdnGestor.tsx` 978 → ~200 linhas.
- `PdnLeadDrawer` ~300 linhas.
- Virtualização da planilha a partir de 100 linhas.

## Fase 7 — Permissões e RLS
- Auditoria de policies em `pdn_entries` e `pipeline_anotacoes`.
- Nenhuma mudança de schema até essa fase.
- Idempotência mantida via hash.

## Fase 8 — Validação ao vivo
Validação ao vivo em cada fase com lead de teste (sempre Cancelar em leads reais). Nenhuma migration destrutiva.

## Decisões fixadas (aprovadas no mockup)
1. Paridade total Planilha ↔ Kanban.
2. Publicação disponível em toda parte (drawer, hover, cards, lote).
3. Drawer com 3 abas (Contexto/Timeline, Ação, Etapa).
4. Idempotência por hash SHA-1 do conteúdo.
5. Padrão por device: Desktop = Planilha, Mobile = Kanban (persistido em `sessionStorage`).

## Status
- **Fase 1:** implementada (`PdnLeadDrawer` com abas Contexto/Ação/Etapa, `PublishButton` idempotente, integração Planilha + Kanban).
- **Fases 2–8:** pendentes de retomada.
