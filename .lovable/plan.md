# Fase 3 — Nova área de Conversas da Lia + filtro de imóvel limpo + celular

## O que você vai ver
1. **Conversas organizada em uma tela só**
   - Topo: busca por nome/telefone, filtro de imóvel e botões Lista | Quadro | Follow-ups | Em trânsito (já existem, ganham visual único).
   - Lista no lado esquerdo com: nome, imóvel, temperatura (Frio/Morno/Quente), última mensagem e há quanto tempo.
   - Ao clicar, a conversa abre do lado direito, com o resumo do cliente e as ações que já existem (descartar, excluir, passar adiante).
   - Contadores no topo de cada visão (ex.: "12 em follow-up").
   - Estado vazio bonito quando não houver conversas no filtro.
2. **Filtro de imóvel limpo**
   - Nada de "curadoria", "flow" ou códigos técnicos: só nomes de empreendimentos reais (Open Bosque, Essence Canoas, Casa Tua POA etc.).
   - Conversas sem empreendimento definido aparecem como "Sem imóvel definido".
   - Mesmo filtro em Lista, Quadro, Follow-ups e Em trânsito.
   - O texto antigo do "cardápio (1 Flow, 2 Casa Tua...)" na Recuperação é atualizado para não citar Flow.
3. **Celular**
   - Lista ocupa a tela; ao tocar, a conversa abre em tela cheia com botão Voltar.
   - Filtros viram uma faixa que se arrasta para o lado; Quadro rola de lado coluna por coluna.

## O que NÃO muda
- Nenhuma regra da Lia, nenhum envio de mensagem, nenhuma alteração em clientes ou na distribuição.
- Os números e listas continuam vindo dos mesmos dados de hoje.

## Validação no final
- Abrir com a sua conta no computador e no celular (390px): Lista, Quadro, Follow-ups, Em trânsito, filtro de imóvel, abrir/fechar conversa. Sem clicar em ações que alteram cliente.
- Conferir que a quantidade de conversas por filtro é igual antes e depois.

## Detalhes técnicos
- `useLiaHub.ts`: ampliar `PRODUTO_LABEL` com os slugs de Natal; `produtosDeEstados` passa a descartar slugs internos (`curadoria`, `cardapio`, `flow*`) e agrupá-los em "Sem imóvel definido".
- `FiltroImovel.tsx` vira componente único (chips roláveis); `LiaLeadsTab.tsx` deixa de ter filtro próprio e usa ele.
- Novo `LiaConversasArea.tsx` (cabeçalho, busca, contadores, troca de visão) reaproveitando `LiaLeadsTab`, `LiaKanbanTab`, `LiaFollowupsTab`, `LiaTransitoTab` e `LiaConversaPane`; `LiaTransitoTab` (470 linhas) dividido para ficar abaixo de 300 linhas por componente.
- Mobile: painel de conversa em tela cheia abaixo de `lg`, com Voltar; teste unitário do filtro de slugs.
