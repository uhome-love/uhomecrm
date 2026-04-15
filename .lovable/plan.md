

## Plano: Diagnosticar e Corrigir Envio WhatsApp

### Diagnóstico

O código frontend (`ConversationThread.tsx`) está correto:
- Campos `telefone` e `mensagem` **batem** com o que a Edge Function `whatsapp-send` espera
- `profileId` carrega com retry (3 tentativas)
- Toasts de erro já existem para `!profileId` e `!leadInfo`
- A Edge Function funciona — logs mostram envios bem-sucedidos por outros corretores

### Causa raiz provável

A Edge Function `whatsapp-send` usa `_sbAuth.auth.getClaims(_token)` para validar JWT. **`getClaims` não é um método padrão do supabase-js v2** — pode funcionar em algumas versões importadas via esm.sh e falhar em outras. Quando falha, retorna 401 silenciosamente. O frontend recebe o erro via `supabase.functions.invoke` mas o comportamento pode variar (erro pode não ser propagado como `throw`).

Além disso, o `sendingRef` pode ficar "travado" em `true` se uma chamada anterior falhou de forma inesperada antes de chegar ao `finally`.

### Alterações

**1. `supabase/functions/whatsapp-send/index.ts`** — Substituir `getClaims` por `getUser`

Trocar:
```typescript
const { data: _claims, error: _claimsErr } = await _sbAuth.auth.getClaims(_token);
if (_claimsErr || !_claims?.claims) { ... }
```
Por:
```typescript
const { data: { user }, error: userErr } = await _sbAuth.auth.getUser();
if (userErr || !user) { ... }
```

`getUser()` é o método padrão e confiável do supabase-js v2 para validar JWT e obter o usuário autenticado.

**2. `src/components/whatsapp/ConversationThread.tsx`** — Robustez no envio

- Resetar `sendingRef` no início do `handleSend` se `sending` state for `false` (proteção contra ref travada)
- Melhorar tratamento do retorno de `supabase.functions.invoke`:
  - Checar `data?.error` corretamente (o invoke pode retornar `{ data, error }` onde `data` contém o JSON da response)
- Adicionar log do response completo para debug

### Resultado esperado
- Auth funciona com `getUser()` para todos os corretores
- Sem refs travadas impedindo envio
- Erros sempre visíveis via toast
- Nenhuma mudança em tabelas

