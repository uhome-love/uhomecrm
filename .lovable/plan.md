## Objetivo

No modal do lead (aba **Histórico**), cada evento da timeline hoje não mostra **quem** registrou. Gestores/gerentes (e qualquer pessoa) precisam ver o autor de cada ação e, no evento "Lead distribuído", **para qual corretor** foi.

## O que existe hoje

Cada registro já guarda o autor no banco, mas a tela ignora esses campos:
- `pipeline_atividades.created_by` → autor da atividade
- `pipeline_tarefas.created_by` → autor da tarefa
- `pipeline_historico.movido_por` → quem moveu de etapa
- `pipeline_anotacoes.autor_nome` → já exibido ("Nota de …")
- `pipeline_leads.corretor_id` / `corretor_anterior_id` → responsável atual/anterior

Todos os IDs de autor (`created_by`, `movido_por`, `corretor_id`) resolvem para o nome via `profiles.user_id = <id>` (confirmado: ~30k atividades batem por `user_id`).

O evento "🔄 Lead distribuído" é montado só com a data (`lead.distribuido_em`), sem indicar o responsável.

## Mudanças (somente frontend)

Arquivo único: `src/components/pipeline/LeadHistoricoTab.tsx`

1. **Resolver nomes dos autores**
   - Coletar o conjunto de IDs envolvidos: `created_by` das atividades e tarefas, `movido_por` do histórico, `corretor_id` e `corretor_anterior_id` do lead.
   - Buscar uma única vez (`profiles` com `user_id in (...)` → `{ user_id: nome }`) num `useEffect`/estado local, e montar um mapa `id → primeiro nome`.

2. **Anexar o autor a cada item da timeline**
   - Adicionar campo opcional `autor` em `TimelineItem`.
   - Atividades: `autor = mapa[a.created_by]`.
   - Histórico (movimentações de etapa): `autor = mapa[h.movido_por]`.
   - Tarefas concluídas: `autor = mapa[t.created_by]`.
   - Anotações: já têm `autor_nome` (mantém).
   - Exibir como sufixo discreto na descrição/legenda do item, ex.: `· por João`.

3. **Evento "Lead distribuído" com destino**
   - No item de `lead.distribuido_em`, montar título/descrição com o responsável atual: `🔄 Lead distribuído → para {nome do corretor_id}` (e, se existir `corretor_anterior_id`, opcionalmente `de {anterior}`).
   - Idem para "Lead aceito": mostrar quem aceitou (corretor atual) quando disponível.

4. **Passar o autor ao componente de timeline**
   - Repassar `autor` no objeto enviado ao `DrawerTimelineGroup` (concatenando na `description`, sem alterar o componente de timeline para manter o escopo mínimo).

## Detalhes técnicos

- A resolução de nome usa `profiles.user_id` (não `profiles.id`) — conforme convenção confirmada para estas colunas.
- Mostrar apenas o **primeiro nome** para manter a timeline enxuta.
- Sem migração, sem mudança de RLS, sem alterar a lógica de distribuição — apenas leitura e exibição.
- Visível para todos os papéis (atribuição histórica é útil), atendendo o pedido de gestor/gerente.
