

# Plano: Corrigir corretor_id no ConversationThread.tsx

## Arquivo: `src/components/whatsapp/ConversationThread.tsx`

### Alterações

1. Adicionar `useState` para `profileId` (string | null)
2. Adicionar `useEffect` no mount que busca `profiles.id` WHERE `user_id = auth.uid()` e guarda no estado
3. No `handleSend`: remover `supabase.auth.getUser()`, usar o `profileId` do estado como `corretor_id` no insert

### Nenhum outro arquivo alterado

| Arquivo | Ação |
|---|---|
| `src/components/whatsapp/ConversationThread.tsx` | Editar (adicionar profileId state + useEffect + corrigir insert) |

