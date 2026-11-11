# Lia Recupera pronta para operar: teste igual ao envio real

## O que aconteceu
Agora a Lia responde, mas respondeu como se você fosse um lead novo do Casa Tua Santos Ferreira. Os registros mostram o motivo:

- O botão **"Enviar teste"** só manda a mensagem no WhatsApp. Ele não faz o que o envio real faz: não anota que aquela conversa é de recuperação e não guarda no histórico a mensagem que foi enviada.
- Quando você respondeu, a Lia não achou nenhuma recuperação ligada ao seu número. Também não viu a mensagem do Natal no histórico. Por isso ela usou o atendimento padrão, que é o do Casa Tua de Canoas.
- O envio real da recuperação já anota a conversa e guarda a mensagem. O erro está só no caminho do teste. Mesmo assim, o teste precisa ser idêntico ao real, senão ele não prova nada.
- Outro risco no teste: se você pedir um especialista, a Lia tentaria colocar o seu número na Fila CEO. Isso contraria o combinado ("no teste, nada vai para a Fila CEO nem para os corretores").

## O que vou fazer

1. **O botão de teste passa a seguir o caminho real**
   - Antes de enviar, apaga a conversa de teste antiga do seu número. Assim a Lia começa do zero, sem as mensagens de "instabilidade" de hoje.
   - Envia a 1ª mensagem da recuperação (Natal Chave de Ouro, Open Bosque, 3 botões), igual a hoje.
   - Guarda no histórico da Lia o texto exato que foi enviado.
   - Anota que essa conversa é uma **recuperação de teste**, com o produto Open Bosque.
2. **A Lia reconhece a recuperação de teste**
   - Ao receber a sua resposta, ela entra no modo recuperação: retoma pelo Natal, faz uma pergunta de cada vez e oferece no máximo 3 imóveis da campanha. Sem Casa Tua de Canoas.
   - Isso só vale com o modo teste ligado e para o número de teste.
3. **Pedido de especialista no teste não vai para ninguém**
   - A Lia manda a mensagem normal de passagem para o especialista, mas não cria nem move lead, não usa a Fila CEO nem a Roleta.
   - Fica só um registro de que, fora do teste, o cliente teria sido passado ao especialista.
4. **A mensagem de "instabilidade" não se repete**
   - Se o cérebro da Lia falhar, ela manda essa mensagem no máximo uma vez a cada 10 minutos por cliente.
   - Cada falha fica registrada como alerta, para eu ver na hora.

## Como vou validar antes de te chamar
1. Aperto "Enviar teste". Você recebe a mensagem do Natal.
2. Simulo, pelo mesmo caminho do WhatsApp, a sua resposta **"Sim, quero ver"** e confiro nos registros:
   - a Lia respondeu falando do Natal, sem citar o Casa Tua Canoas;
   - a resposta foi só para o seu número.
   Essa resposta chega de verdade no seu WhatsApp.
3. No Laboratório, sem enviar nada, confiro mais três situações:
   - "Outro perfil": ela pergunta o que você busca e oferece até 3 imóveis do Natal;
   - "Não quero mais contato": ela encerra e bloqueia;
   - pedido de especialista: ela faz a passagem, e nada entra na Fila CEO.
4. Confiro que nenhum lead real foi criado ou alterado.
5. Depois você conversa com a Lia pelo celular, como cliente, e me diz se está bom.

## O que não muda
- O envio para clientes continua travado no seu número. Só libero quando você mandar.
- As regras da conversa continuam as mesmas: nunca inventar valor, linguagem humana, 35 anos com ressalva.
- Lead novo de anúncio continua no fluxo de hoje.
- Não há mudança visual na tela. Só a confirmação do botão passa a dizer "Conversa de teste reiniciada e mensagem enviada". Por ser tão pequena, não fiz desenho.
- Não precisa de mudança no banco hoje.

## Detalhes técnicos
- `lia-modo-teste`:
  - apaga de `lia_conversas` e `lia_estado` só as linhas do telefone de teste;
  - envia `lia_recupera_a` com os dados ("Lucas", "Open Bosque");
  - grava `lia_conversas` (role assistant, `MODELO_TEXTO` preenchido, `wa_message_id`);
  - grava `lia_estado` com `recuperacao=true`, `lead_id=null`, `produto_slug='open-bosque'`, `nome='Lucas'`.
- `_shared/liaRecuperaContexto.ts`: quando `recuperacao=true`, não há `lead_id` e o modo teste permite o número, monta o contexto com `contextoRecuperacao`, usando o nome e o produto do estado. Fora do teste, sem lead, continua devolvendo `null`.
- `lia-whatsapp` `qualificar`: se for recuperação sem `lead_id` (teste), pula `handoffRecupera` e `criarLeadFila`, grava `ops_events` com `category='lia_teste_handoff'` e mantém a mensagem de passagem.
- Fallback de instabilidade:
  - antes de enviar, olha em `ops_events` se houve `lia_instabilidade` para o mesmo telefone nos últimos 10 minutos;
  - sempre grava o evento, com o status HTTP do `lia-chat`.
- Deploy: `lia-modo-teste`, `lia-whatsapp`, `lia-followup`.
- A simulação do webhook usa o mesmo payload do 360dialog, com a autenticação de `liaWebhookAuth`.
