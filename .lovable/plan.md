# Validar o template de abertura do plantão (Casa Tua Canoas) e ligar a arte

## O que já verifiquei

- A Central de Reengajamento só lista templates com status **aprovado** na Meta. O da sua tela
  aparece como "Ativo — Qualidade pendente", ou seja, já está liberado para uso.
- O CRM tem um mapa que associa cada template à arte do cabeçalho. Hoje existe a entrada
  `abertura_casatuadecanoas` (arte antiga do Open House de 12/09). O template novo da tela
  (`abertura_casa_tua_canoas_2209`) **ainda não tem arte associada** — por isso o campo de imagem
  vem vazio ao selecioná-lo.
- A regra que rotula o lead como **Casa Tua Canoas** já funciona por conter "canoas" no nome do
  template, então o novo nome já cai certo no produto de Canoas. Nada a mudar aí.

## O que vou fazer

1. Confirmar na Meta o **nome exato e o idioma** do template novo (a tela corta o nome) e que ele
   tem cabeçalho de imagem.
2. Subir a arte "Abertura Oficial do Plantão — 22/09" em JPG otimizado (abaixo de ~300 KB) no
   mesmo espaço público de imagens de campanha usado pelos outros disparos.
3. Associar essa arte ao template novo, para que ao selecioná-lo no Disparo manual a imagem já
   venha preenchida sozinha.
4. Validar ao vivo em Central de Reengajamento → Disparo manual: abrir o seletor, escolher o
   template, conferir que a imagem carrega no preview e que o produto aparece como Casa Tua Canoas.
   **Sem disparar nada para ninguém.**

## Detalhes técnicos

- Upload no bucket público `campaign-images`, pasta `reengajamento`, arquivo
  `abertura-plantao-canoas-2209.jpg` (conversão/compressão local antes do upload).
- `src/components/central-nutricao/DisparoCustomizadoCard.tsx`: nova entrada em
  `TEMPLATE_HEADER_IMAGES` com o nome exato do template retornado pela Meta.
- Sem migration, sem alteração de edge function, sem mudança no motor de disparo.
- `src/lib/reengajamentoEmpreendimento.ts` não muda (regra `canoas` já existe e vem antes da regra
  genérica de Casa Tua).
