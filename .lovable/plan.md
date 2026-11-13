# Preparar o disparo "openarvoredo_convite" no CRM

## O que muda para você
- Na Central de Disparos, o modelo **openarvoredo_convite** passa a sair com a imagem dos 2 e 3 dormitórios (a mesma que você enviou à Meta).
- Quem responder **"Sim! Gostaria de ir amanhã"** já entra marcado como **Open Arvoredo** (o CRM já reconhece esse nome), indo para a Fila CEO ou travando a tela do corretor dono do lead, como hoje.
- "Não tenho interesse" segue a regra atual de saída.
- Nada é disparado por mim. Você escolhe a base e dispara quando a Meta aprovar o modelo.

## Detalhes técnicos
- Enviar `open-arvoredo-reengajamento-2e3dorms.jpg` para o armazenamento público `campaign-images/reengajamento/`.
- Adicionar `openarvoredo_convite` ao mapa de imagens em `DisparoCustomizadoCard.tsx` (mesmo padrão dos convites de sábado).
- Variável {{1}} = primeiro nome, como nos outros modelos.
- Sem mudança no banco nem nas regras de resposta.

## Validação
- Conferir no computador e no celular (390px) que o modelo aparece com a imagem certa na prévia do disparo, sem enviar nada.
- Conferir se o modelo já consta como aprovado na Meta; se ainda estiver em análise, aviso.
