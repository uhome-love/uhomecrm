

# Plano: Notas na Timeline — Visão 360 do Lead

## O que muda

Hoje as notas (anotações) ficam numa seção separada abaixo da timeline no `LeadHistoricoTab`. O corretor não tem visão cronológica unificada.

A mudança é simples: incluir as anotações como itens na timeline, ordenadas junto com atividades, movimentações de etapa, tarefas concluídas e eventos de imóvel.

## Implementação

### Arquivo: `src/components/pipeline/LeadHistoricoTab.tsx`

1. Na função `buildTimeline`, adicionar loop pelas `anotacoes` criando itens do tipo `"anotacao"`:
   - Título: `📝 Nota de {autor_nome}`
   - Descrição: conteúdo da nota
   - Ícone: `StickyNote`
   - Cor: notas fixadas em amarelo, normais em cinza
   - sourceType: `"anotacao"`, sourceId: `nota.id`

2. Atualizar o tipo `TimelineItem.sourceType` para incluir `"anotacao"`

3. Manter a seção de notas separada (input + lista) como está — o corretor continua podendo criar e fixar notas ali. A diferença é que agora elas também aparecem na timeline cronológica.

4. Na função `handleDeleteItem`, adicionar suporte para deletar anotações (`pipeline_anotacoes`)

## O que NÃO muda
- Botão ligar (já funciona com CallFocusOverlay)
- Tarefas inline (já funciona com LeadTarefasTab)
- WhatsApp (já funciona com WhatsAppFocusFlow)
- Sugestão de imóvel (adiado)
- Layout do Lead Detail (adiado)
- Central de Tarefas e Agenda (continuam independentes)

## Risco
Nenhum. É uma adição ao array de items da timeline. Nenhum fluxo existente é alterado.

## Teste
- Abrir lead detail → aba Histórico
- Criar uma nota → deve aparecer na timeline na posição cronológica correta
- Nota fixada deve ter visual diferenciado (amarelo) na timeline
- Deletar nota pela timeline deve funcionar
- Seção de notas abaixo continua funcionando normalmente

