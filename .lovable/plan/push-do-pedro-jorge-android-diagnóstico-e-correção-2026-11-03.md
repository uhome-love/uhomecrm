# Push do Pedro Jorge (Android): diagnóstico e correção

## O que a auditoria mostrou
- Pedro Jorge tem 2 inscrições de notificação. As duas são de **computador Windows (Chrome)**, criadas em 15/09 e 17/09. **Nenhuma é do celular Android.** O CRM nunca recebeu a permissão do telefone dele, então não tem para onde mandar o aviso.
- Na semana passada tiramos do topo o aviso "Ative as notificações push". Hoje o único caminho para ativar fica escondido nas preferências, e no celular quase ninguém acha.

## O que vou fazer
1. **Sino de notificações (celular e computador):** quando o aparelho ainda não tem push ativo, aparece no topo da lista do sino uma linha discreta "Ativar notificações neste aparelho", com botão. Nada volta para o topo da tela.
2. **Permissão bloqueada no Android:** se o Chrome já negou antes, a linha explica como liberar: cadeado ao lado do endereço → Permissões → Notificações → Permitir.
3. **Botão "Enviar teste"** depois de ativar, para o corretor confirmar na hora.
4. Conferir com a conta de teste que ativar grava a inscrição do aparelho e que o teste chega, sem mexer nas regras de envio.

## Para o Pedro (depois de publicado)
Abrir o CRM no Chrome do celular → sino → "Ativar notificações" → Permitir → "Enviar teste". Se não aparecer o pedido de permissão, liberar pelo cadeado. Conferir também se o Android não está com as notificações do Chrome desligadas ou com a economia de bateria bloqueando.

## Técnico
- Reaproveitar `usePushSubscription` (permissão, inscrição) dentro do painel do sino. Não reativar `PushPromptBanner`.
- O teste usa a função de envio que já existe, só para o próprio usuário.
