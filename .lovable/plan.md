

## Plano: Corrigir Envio WhatsApp + Ajustes Menores

### Problema Principal — Envio silencioso
`handleSend()` na linha 213 faz `if (!text.trim() || !leadInfo || !profileId) return;` — retorno silencioso. Se `profileId` não carregou (query do profiles falhou), o corretor clica enviar e nada acontece, sem nenhum feedback.

### Alterações

**1. `src/components/whatsapp/ConversationThread.tsx`**
- Substituir o `return` silencioso por toasts informativos:
  - `!profileId` → toast.error("Perfil não carregado. Recarregue a página.")
  - `!leadInfo` → toast.error("Dados do lead não disponíveis.")
- Adicionar `console.log` no início do handleSend para debug
- Adicionar retry na query de profileId (se falhar, tentar novamente)
- Adicionar opção "Em 2 dias" no select de prazo da tarefa
- Adicionar input `type="date"` para prazo personalizado na criação de tarefa

**2. `src/components/whatsapp/HomiCopilotCard.tsx`**
- Sem alterações necessárias — o componente já recebe `lastReceivedOrSent?.body` e re-analisa quando muda

**3. `supabase/functions/homi-copilot/index.ts`**
- Sem alterações necessárias — já tem contexto completo do CRM

**4. `supabase/functions/whatsapp-send/index.ts`**
- Sem alterações — conforme solicitado

### Detalhes técnicos

Mudança no handleSend:
```typescript
const handleSend = async () => {
  console.log("handleSend called", { text: text.trim(), leadInfo: !!leadInfo, profileId });
  if (!text.trim()) return;
  if (!profileId) {
    toast.error("Perfil não carregado. Recarregue a página.");
    return;
  }
  if (!leadInfo) {
    toast.error("Dados do lead não disponíveis.");
    return;
  }
  // ... rest
};
```

Retry no carregamento do profileId:
```typescript
useEffect(() => {
  const loadProfile = async (retries = 3) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
    if (data) {
      setProfileId(data.id);
    } else if (retries > 0) {
      setTimeout(() => loadProfile(retries - 1), 1000);
    } else {
      console.error("Failed to load profileId", error);
    }
  };
  loadProfile();
}, []);
```

Adição de "2 dias" e data personalizada no task deadline:
```typescript
<SelectItem value="2dias">Em 2 dias</SelectItem>
// + input date quando selecionado "custom"
<SelectItem value="custom">📅 Data específica</SelectItem>
```

### Resultado
- Corretor recebe feedback claro se envio falhar
- ProfileId tem retry automático
- Console.log para debug do fluxo
- Tarefa com opção de 2 dias e data personalizada

