# Tirar o pop-up de "Lead reengajado" para CEO, gerentes e gestores

## O que muda
- CEO, gerentes e gestores deixam de ver o pop-up no canto inferior direito quando chega um lead reengajado.
- Para eles, o aviso continua no **sininho**, só não aparece mais na tela.
- **Corretores continuam recebendo** o pop-up e o push quando o lead deles responde "Sim".
- Nada muda em leads, Fila do CEO, roleta ou disparos.

## Como vou validar
- Conferir que não há erros depois da mudança e que o aviso segue aparecendo no sininho.

## Detalhes técnicos
- `src/hooks/useNotifications.ts`: no listener em tempo real, se `tipo === "lead_reengajado"` e o usuário for admin/gestor (pelo `useUserRole`), pular o `toast` e a notificação do desktop. Só invalidar a query do sino.
- Sem migration e sem mudança no backend.
