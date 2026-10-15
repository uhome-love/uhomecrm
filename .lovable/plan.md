# Imagem do disparo `openarvoredo_novidade` — validação e cadastro na Central

## Validação da arte
Aprovada para uso. Pontos conferidos:
- Formato quadrado 1254×1254, nítida e legível no celular. Tamanho 2,3 MB (a Meta aceita até 5 MB).
- Preços batem com o texto do modelo: 2 dorms a partir de R$ 329 mil e 3 dorms a partir de R$ 392 mil, com suíte e vaga.
- "Responda QUERO": o CRM já entende "quero" como SIM, então o cliente cai na Fila CEO do mesmo jeito que pelo botão.

Sugestões (opcionais, não bloqueiam):
- A arte fala em "Peça a simulação", e o texto convida para "conhecer os decorados neste sábado". O ideal é usar uma chamada só. Por exemplo, trocar para "Agende sua visita · Responda QUERO".
- "Ato a partir de R$ 2 mil" está só na imagem. Se for condição real, vale colocar também no texto.
- Plantas e fachada geradas por IA: confirmar com a construtora se representam o produto, para evitar reclamação.

## Cadastro na Central de Reengajamento
- Subir a imagem para o armazenamento das artes de disparo (`reengajamento/openarvoredo-novidade.png`).
- Ligar a arte ao modelo `openarvoredo_novidade` na Central, para aparecer na pré-visualização e ir junto no disparo, igual ao Open Bosque.

## Validação
- Abrir a Central, escolher o modelo `openarvoredo_novidade` e conferir a imagem na pré-visualização. Sem disparar para ninguém.

## Detalhes técnicos
- Upload via storage para o bucket `campaign-images`, caminho `reengajamento/openarvoredo-novidade.png`.
- `DisparoCustomizadoCard.tsx`: nova entrada `openarvoredo_novidade: ".../campaign-images/reengajamento/openarvoredo-novidade.png"` no mapa de imagens.
