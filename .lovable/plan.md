

# Plano: Layout full-height sem scroll (estilo WhatsApp Web)

## Resumo

Ajustar classes Tailwind nos 4 componentes para que a página ocupe 100vh sem scroll externo, com scroll interno independente em cada coluna.

## Alterações por arquivo

### 1. `WhatsAppInbox.tsx` (wrapper)
- Linha 330: já tem `h-[calc(100vh-56px)] flex flex-col` — OK
- Linha 339: `flex flex-1 overflow-hidden` — adicionar `min-h-0` (crítico para flex shrink com scroll interno)

### 2. `ConversationList.tsx`
- Linha 145: wrapper já tem `flex flex-col h-full` — adicionar `overflow-hidden min-h-0`
- Header (linhas 147+): adicionar `flex-shrink-0`
- Lista interna de itens (o div que renderiza as conversas): adicionar `flex-1 overflow-y-auto min-h-0`
- Footer/botão "Nova conversa": adicionar `flex-shrink-0`

### 3. `ConversationThread.tsx`
- Linha 328: wrapper já tem `flex-1 flex flex-col h-full` — adicionar `overflow-hidden min-h-0`
- Header (linha 330): adicionar `flex-shrink-0`
- Messages div (linha 354): já tem `flex-1 overflow-y-auto` — adicionar `min-h-0`
- Copilot card (linha 405): envolver em div com `flex-shrink-0 max-h-[180px] overflow-y-auto`
- Quick action bar (linha 416): adicionar `flex-shrink-0`
- Input area: adicionar `flex-shrink-0`

### 4. `LeadPanel.tsx`
- Linha 210: wrapper já tem `overflow-y-auto flex flex-col` — adicionar `h-full min-h-0`
- Linha 203 (empty state): adicionar `h-full min-h-0`

## Nenhuma alteração de lógica
Apenas classes CSS. Nenhuma query, edge function ou estado será modificado.

