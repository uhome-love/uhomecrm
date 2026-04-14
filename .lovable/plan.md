

# Plano: Corrigir 3 bugs + layout full-height do WhatsApp Inbox

## Diagnóstico

### BUG 1 — Follow-up zerado
Confirmado via query: `pipeline_leads.corretor_id` armazena `auth.uid` (ex: `cd3bd7ae-...`), **não** `profiles.id`. As queries de `loadSuggestions` (linhas 188, 210) usam `user.id` (auth.uid) — **está correto**. O problema real é que a query de `whatsapp_mensagens` para obter `leadsWithMessages` (linha 175) busca **todos** os leads com mensagem, sem filtrar por corretor. Isso faz com que leads de **outros corretores** que já têm mensagens sejam excluídos indevidamente do follow-up e novos leads do corretor atual.

**Correção**: Filtrar `whatsapp_mensagens` por `corretor_id = profileId` ao buscar `leadsWithMessages`.

### BUG 2 — Nota interna persistindo
O `isNoteMode` não é resetado ao trocar de lead. Só reseta após envio (linha 228). Falta um `useEffect` que reseta ao mudar `leadId`.

### BUG 3 — SLA badge
O `SLABadge` está sendo renderizado (linha 260 do ConversationList). Ele só aparece quando `hours >= 2` (linha 63). Funciona corretamente — mas o `lastReceivedTs` só é definido se a **última** mensagem é `received`. Se o corretor respondeu, `lastReceivedTs` fica `null` e o badge não aparece. Isso é comportamento correto (SLA resolvido). O badge está funcional.

### LAYOUT — Scroll externo
**Causa raiz**: O `<main>` em `AppLayout.tsx` (linha 252) tem `overflow-y-auto` e `p-4 sm:p-6 lg:p-8`. Isso faz a página WhatsApp ter padding indesejado e scroll externo pelo main. A solução é remover o padding e overflow do main **apenas** para a rota /whatsapp.

## Alterações

### 1. `WhatsAppInbox.tsx`
- Adicionar classes para anular o padding do main pai: usar margem negativa ou, melhor, fazer o componente expandir para preencher o main com `h-full` em vez de `h-[calc(100vh-56px)]` e confiar no flex do pai.
- Alterar wrapper para: `h-full flex flex-col overflow-hidden -m-4 sm:-m-6 lg:-m-8` (margem negativa para anular o padding do main)
- Na `loadSuggestions`: filtrar `whatsapp_mensagens` por `corretor_id = profileId` em vez de buscar todas.

### 2. `ConversationThread.tsx`
- Adicionar `useEffect` para resetar `isNoteMode = false` quando `leadId` mudar.
- No botão de nota, quando ativo, mostrar texto "Nota ON" em amarelo.

### 3. `ConversationList.tsx`
- Sem alterações (layout já correto com flex-1, overflow-y-auto, min-h-0).

### 4. `LeadPanel.tsx`
- Sem alterações (layout já correto).

## Resumo de arquivos editados

| Arquivo | Alteração |
|---|---|
| `WhatsAppInbox.tsx` | Fix layout (margem negativa), fix query leadsWithMessages filtrar por profileId |
| `ConversationThread.tsx` | Reset isNoteMode ao trocar leadId, visual "Nota ON" no botão |

Nenhuma alteração em Edge Functions, tabelas ou outros componentes.

