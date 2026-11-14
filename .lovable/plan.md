# Interesse declarado quando a resposta não cita um produto específico

## O que muda
Quando o cliente responde algo genérico ("Quero ver em POA", "Quero casa em Porto Alegre", "Tenho interesse"), o CRM não força um empreendimento. Ele registra o **interesse declarado** com as palavras do cliente.

## 1. Corrigir os leads já afetados
- **mara** e **Luana**: tirar "Casa Tua Canoas" do produto.
- Interesse passa a mostrar o que elas disseram (ex.: "Interesse declarado: imóvel em Porto Alegre").
- Anotação no histórico explicando a troca e citando a resposta original.
- Corretor e etapa continuam iguais.

## 2. Daqui para frente (resposta de remetente novo no WhatsApp)
- Se a resposta cita um produto ou vem de um botão de um disparo de produto → mantém o produto (como hoje).
- Se a resposta é texto livre que **contradiz ou generaliza** o produto da mensagem (cita outra cidade/região ou pede "qualquer imóvel") → fica sem produto específico e grava o interesse declarado.
- O histórico sempre mostra a frase do cliente e a mensagem que ele recebeu.

## 3. Onde aparece
- Ficha do lead, campo "Interesse" no Resumo do lead: "Interesse declarado: …".
- Cartão do Pipeline: mostra o interesse no lugar do nome do produto.

## Detalhes técnicos
- Interesse genérico gravado em `campanha` como `Interesse declarado: <região/texto>` e `empreendimento` vazio; o gatilho do produto canônico não casa com esse texto, então o lead fica sem canônico (sem efeito na Roleta, que só usa lead novo).
- Webhook (ramo remetente novo): detecção simples por palavras de região (POA, Porto Alegre, Canoas, zona…) que divergem da cidade do produto do disparo.
- Correção dos 2 leads por atualização pontual de dados, conferida antes/depois.
- Validação: teste da regra de detecção + conferência no banco + ficha no computador e celular 390px.
