

# Plano: Página /configuracoes/whatsapp

## Arquivo novo

`src/pages/ConfiguracoesWhatsApp.tsx`

## Estrutura

1. **Ao montar**: chama `whatsapp-connect` com `action="status"` para obter estado atual
2. **Card de Status**: ícone WhatsApp, badge animado (conectado/aguardando/desconectado), número se disponível
3. **Botão "Conectar meu WhatsApp"**: visível se não conectado — chama `action="create"` → `action="qrcode"` → abre modal com QR base64 → polling `action="status"` a cada 3s → fecha modal ao conectar
4. **Modal QR Code**: Dialog com imagem base64, instruções, timer 60s, botão "Gerar novo QR Code" ao expirar
5. **Botão "Desconectar"**: visível se conectado, cor vermelha, confirmação via Dialog antes de chamar `action="disconnect"`
6. **Card de Privacidade**: ícone cadeado + texto explicativo

## Rota

Em `App.tsx`, adicionar:
- Lazy import de `ConfiguracoesWhatsApp`
- Rota: `<Route path="/configuracoes/whatsapp" element={<ProtectedPage roles={["corretor", "admin"]}><ConfiguracoesWhatsApp /></ProtectedPage>} />`

## Design

- Fundo `#f7f7fb`, cards brancos `rounded-xl`, accent `#4F46E5`
- Usa componentes existentes: `Card`, `Button`, `Dialog`, `Badge`
- Ícones de `lucide-react` (MessageSquare, Shield, QrCode, Loader2)

## Chamadas à Edge Function

```typescript
const res = await supabase.functions.invoke("whatsapp-connect", {
  body: { action: "status" | "create" | "qrcode" | "disconnect" }
});
```

## O que NÃO será alterado

- Sidebar, hooks, componentes existentes, outras páginas
- Apenas `App.tsx` recebe uma nova rota + lazy import

## Entrega

| Arquivo | Ação |
|---|---|
| `src/pages/ConfiguracoesWhatsApp.tsx` | Criar |
| `src/App.tsx` | Adicionar import + rota |

