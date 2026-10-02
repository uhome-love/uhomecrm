# Template convitesabado_casatuacanoas: validar e ligar a arte

## O que já verifiquei
- Pelo seu print, a Meta ainda mostra o modelo **"Em análise"**. Enquanto ele não for aprovado, ele não aparece no Disparo manual e não dá para enviar.
- A arte ainda não está ligada a esse modelo. Ao escolher o modelo, o campo da imagem viria vazio.
- Quem responder "Sim, quero participar" entra como **Casa Tua Canoas**, porque o nome do modelo tem "canoas". Se o cliente já tiver corretor, ele continua com esse corretor, e o corretor recebe o aviso. A mensagem enviada aparece na linha do tempo do lead.

## O que vou fazer
1. Confirmar com a Meta o status, o idioma e se o modelo tem imagem no cabeçalho.
2. Diminuir o tamanho da arte anexada (menos de 300 KB) e salvar no mesmo lugar das outras artes de campanha.
3. Ligar a arte ao modelo, para a foto aparecer sozinha no Disparo manual.
4. Abrir a Central de Reengajamento e conferir o modelo e a foto, **sem enviar nada**. Se a Meta ainda não tiver aprovado, deixo tudo pronto e te aviso.

## Detalhes técnicos
- Upload: `campaign-images/reengajamento/convitesabado-casatuacanoas.jpg`.
- `DisparoCustomizadoCard.tsx`: nova entrada em `TEMPLATE_HEADER_IMAGES`.
- Não precisa de mudança no banco, nas funções de servidor ou no envio. A regra `canoas` já cobre esse modelo.
