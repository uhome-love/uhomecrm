

## Plano: Simplificar tabs do WhatsApp Inbox

### Mudança

Remover os botões **"Ativas"** e **"Follow-up"** da lista de conversas. Manter apenas **Todas**, **Não lidas** e **Novos**.

### Arquivo: `src/components/whatsapp/ConversationList.tsx`

1. **Remover tabs** `active` e `followup` do array `tabs` (linhas 268-274)
2. **Remover tipo** `"active" | "followup"` do type `Tab`
3. **Simplificar flags**: remover `showFollowUp` e `showActive` — conversas sempre aparecem; "Novos" aparece em `tab === "all"` ou `tab === "new"`
4. **Remover seção "Follow-up sugerido"** (linhas 414-460) — o grupo inteiro sai do render
5. **Remover props** `followUpLeads` e `FollowUpLead` do componente (cleanup)
6. **No header**: remover menção a "ativas", simplificar para `{conversations.length} conversas · {newLeads.length} novos`

### Arquivo: `src/pages/WhatsAppInbox.tsx`

7. **Aumentar limite de novos leads**: mudar `.slice(0, 5)` para `.slice(0, 15)` (linha 330) para que apareçam mais leads na aba "Novos"
8. **Remover** `followUpLeads` state e a query de follow-up (linhas 298-318) — código morto
9. **Remover** prop `followUpLeads` do `<ConversationList>`

### Resultado

| Tab | Mostra |
|-----|--------|
| Todas | Conversas com mensagens + Novos leads (Sem Contato) |
| Não lidas | Só conversas com unreadCount > 0 |
| Novos | Só leads "Sem Contato" sem mensagens WhatsApp |

Nenhuma alteração em Edge Functions ou tabelas.

