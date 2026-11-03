# Push do Pedro Jorge — diagnóstico e correção

## O que a auditoria mostrou
- Pedro Jorge tem 2 inscrições de notificação, as duas de **computador Windows (Chrome)**, de 15/09 e 17/09. **Nenhuma do celular.** O CRM nunca recebeu permissão do telefone dele, então não tem para onde mandar.
- Na semana passada tiramos do topo o aviso "Ative as notificações push" e também o aviso "Instale o Uhome". Hoje o único caminho para ativar é escondido nas preferências — no celular praticamente ninguém acha.
- Se o celular dele for **iPhone**, só recebe push com o CRM adicionado à Tela de Início e aberto por lá (regra da Apple).

## O que vou fazer
1. **Sino de notificações (celular e computador):** quando o aparelho não tem push ativo, mostrar no topo da lista do sino uma linha discreta "Ativar notificações neste aparelho" com botão. Nada volta para o topo da tela.
2. **iPhone fora da Tela de Início:** em vez do botão, a linha mostra o passo a passo curto (Compartilhar → Adicionar à Tela de Início → abrir pelo ícone).
3. **Permissão bloqueada:** se o celular negou antes, mostrar como liberar nas configurações do navegador.
4. **Botão "Enviar teste"** depois de ativar, para o corretor confirmar na hora.
5. Conferir com a conta de teste que ativar grava a inscrição do aparelho e o teste chega; sem mexer em regras de envio.

## Para o Pedro (depois de publicado)
Abrir o CRM no celular → sino → "Ativar notificações" → permitir → "Enviar teste". Se for iPhone, antes adicionar à Tela de Início.

## Técnico
- Reaproveitar `usePushSubscription` (já tem `isIOSNotPWA`, permissão, subscribe) dentro do painel do sino; não reativar `PushPromptBanner`.
- Teste via função de envio existente só para o próprio usuário.
