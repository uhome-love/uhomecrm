# Conversão "Visita realizada (CRM)" no Google Ads

## O que encontrei antes de planejar
- **O código do Google (gclid) hoje não fica guardado no CRM.** Nos últimos 60 dias, nenhum dos 2.965 leads tem esse código salvo. A entrada de leads do site trata o gclid como campo de rastreio e o descarta.
- **Não existe uma etapa chamada "Visita realizada".** A visita conta como realizada quando o corretor registra o resultado "realizada", e o lead segue para Pós-Visita. A visita já é detectada nesse momento para o Meta, e o Google vai usar esse mesmo gatilho.

## O que será feito
1. **Guardar o gclid quando o lead chega do site.** O código fica salvo no lead e não aparece na tela do corretor. Leads antigos não têm o código e por isso não serão enviados.
2. **Enviar a conversão quando a visita for registrada como realizada.** O envio só acontece se o lead tiver gclid. Ele vai para a conta 104-122-6095, na conversão "Visita realizada (CRM)" (7903119344), com valor de 100 BRL e a data e hora da visita no fuso -03:00.
3. **Enviar uma vez por lead.** Uma trava no banco impede o envio duplicado, mesmo quando a visita é remarcada ou registrada de novo.
4. **Registrar no histórico do lead:** "Conversão de visita enviada ao Google Ads". Se o Google recusar, o histórico mostra o motivo, e eu recebo um alerta.
5. **Sem gclid, nada é enviado** e nada é anotado.
6. **Uma falha no Google nunca bloqueia o registro da visita**, seguindo a mesma regra do rastreamento do Meta.

## Validação
- Um teste confirma que o envio acontece só com gclid e só uma vez por lead.
- O envio será testado primeiro no modo "só validar" do Google, sem contar como conversão. Depois, você aprova o primeiro envio real.
- A tela do corretor não muda. Por isso, este pedido não precisa de mockup.

## Detalhes técnicos
- Coluna `gclid` em `pipeline_leads`, preenchida pela função de entrada do site (`site-lead-webhook`) e por `formRespostas` (sem mudar a lista de campos ignorados nas respostas).
- Fila `google_ads_conversoes` (lead único por conversão, status, resposta), preenchida por um gatilho em `visitas` quando `status='realizada'`, com `EXCEPTION WHEN OTHERS`.
- Função `google-ads-conversao-dispatch` (agendada a cada 5 min) chama `uploadClickConversions` pela conexão do Google Ads do workspace, com `conversionDateTime` no formato `yyyy-mm-dd hh:mm:ss-03:00` e `partialFailure`. Depois do envio, grava a anotação no lead.
- Uma migration, fora do limite de 2 por dia em horário comercial, se necessário.
