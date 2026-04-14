

# Plano: Corrigir 2 bugs (status + filtro corretor)

## Bug 1 — `LeadWhatsAppTab.tsx` linha 49

**Problema**: `.eq("status", "connected")` mas o banco usa `"conectado"`.

**Correção**: Trocar para `.eq("status", "conectado")`.

Adicionalmente, `corretor_id` na query usa `user!.id` (auth.uid), mas a FK referencia `profiles.id`. Precisa buscar o `profiles.id` primeiro.

## Bug 2 — `WhatsAppInbox.tsx` linha 42-47

**Problema**: `loadConversations` busca todas as mensagens sem filtrar pelo corretor logado.

**Correção**:
1. Adicionar estado `profileId` e buscar `profiles.id` WHERE `user_id = auth.uid()` no mount
2. Em `loadConversations`: adicionar `.eq("corretor_id", profileId)` na query
3. Em `LeadWhatsAppTab.tsx`: usar o mesmo `profileId` na query de `whatsapp_instancias`

## Bug extra encontrado — `ConversationThread.tsx` linha 89

O insert de mensagem usa `user?.id` (auth.uid) como `corretor_id`, mas a FK espera `profiles.id`. Porém o usuário pediu para NÃO alterar outros componentes. Vou sinalizar mas NÃO corrigir agora.

## Resumo de alterações

| Arquivo | Alteração |
|---|---|
| `src/components/pipeline/LeadWhatsAppTab.tsx` | Buscar `profiles.id` do user; trocar `"connected"` → `"conectado"`; usar profileId na query |
| `src/pages/WhatsAppInbox.tsx` | Buscar `profiles.id` do user; filtrar mensagens por `corretor_id = profileId` |
| `src/components/whatsapp/ConversationThread.tsx` | **NÃO alterado** (bug sinalizado para próxima iteração) |

## Alerta

O insert em `ConversationThread.tsx:89` grava `auth.uid()` como `corretor_id` quando deveria ser `profiles.id`. Isso causará mensagens "invisíveis" ao filtro corrigido. Recomendo corrigir na próxima iteração.

