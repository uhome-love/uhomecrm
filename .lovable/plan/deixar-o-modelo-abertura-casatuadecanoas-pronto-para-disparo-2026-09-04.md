# Deixar o modelo `abertura_casatuadecanoas` pronto para disparo

## O que já verifiquei

- O modelo é o **abertura_casatuadecanoas** (Português BR), com **imagem no topo**, texto com o nome do
  cliente e **dois botões** ("Sim, quero conhecer" / "Nao, obrigado"). Está **Ativo** na Meta
  (qualidade pendente), então já aparece para seleção na Central de Reengajamento.
- A arte que você anexou **ainda não está no nosso servidor de imagens** e o modelo **não tem arte
  vinculada** na Central — hoje, ao selecioná-lo, o campo de imagem fica vazio e o disparo sairia sem
  a arte.
- As respostas dos botões (Sim/Não) **já são tratadas automaticamente** pelo fluxo atual: "Sim" vai
  para a Fila CEO e "Não" encerra/inativa. Nada a mudar aí.
- **Problema de rótulo:** o nome do modelo é "casatua**de**canoas". A regra atual só reconhece
  "casatuacanoas", então o lead reengajado seria etiquetado como **Casa Tua (POA)** em vez de
  **Casa Tua Canoas** — produto errado na Fila CEO e no lead.

## O que vou fazer

1. **Publicar a arte anexada** no nosso servidor de imagens de campanha, em JPG otimizado (bem mais
   leve que o original, para não falhar/atrasar no envio da Meta).
2. **Vincular a arte ao modelo** `abertura_casatuadecanoas`: ao selecionar o modelo na Central, a
   imagem já vem preenchida sozinha e aparece no preview.
3. **Corrigir o rótulo do produto** para reconhecer "casatuadecanoas" (e variações com "canoas") como
   **Casa Tua Canoas**, antes da regra genérica de Casa Tua.
4. **Validar ao vivo** em `/central-nutricao` → Disparo manual: selecionar o modelo, conferir a arte no
   preview, conferir o público e o rótulo de produto. **Sem disparar nada** — deixo pronto para você
   apertar o botão.

## Detalhes técnicos

- Upload no bucket público `campaign-images`, pasta `reengajamento`, arquivo
  `abertura-casatuadecanoas.jpg` (conversão/compressão local antes do upload).
- `src/components/central-nutricao/DisparoCustomizadoCard.tsx`: nova entrada
  `abertura_casatuadecanoas` em `TEMPLATE_HEADER_IMAGES`.
- `src/lib/reengajamentoEmpreendimento.ts`: regra de Canoas passa a cobrir `casatuadecanoas` /
  `casa tua de canoas` / `canoas`, mantendo a precedência sobre Casa Tua POA.
- Sem migration, sem alteração no motor de disparo e sem mexer no tratamento dos botões
  (`whatsapp-webhook` já cobre Sim/Não).
