# Pipeline do CEO desatualizado (lead Marie Hellen não aparece)

## O que aconteceu
- A Marie Hellen é uma cliente antiga (de março, antes interessada em Orygem). Hoje às 09:34 ela preencheu o formulário do Golden Lake. O sistema atualizou o interesse dela para Golden Lake e mandou o lead para a Rafaela. Às 09:38 a Rafaela registrou "Ligou", e o lead foi para Sem Contato.
- No banco está tudo certo: o lead está ativo, com a Rafaela, em Sem Contato, como Golden Lake.
- O problema está na sua tela. Na visão Empresa (CEO, diretora e gerente), o pipeline não se atualiza sozinho. Isso foi desligado de propósito, porque as tarefas automáticas mudavam os números o tempo todo e a tela piscava.
- Então sua tela ainda guardava a Marie como "Orygem / Novo Lead". Por isso a busca "Golden lake" não encontrou ela em nenhuma coluna.

## Solução imediata (sem código)
- Feche e abra o Pipeline de novo, ou puxe a tela para baixo para recarregar. A Marie deve aparecer em Sem Contato.

## Correção proposta
1. Na visão Empresa, buscar a cada 60 segundos só os leads que mudaram desde a última carga. Isso inclui mudança de etapa, de corretor, de empreendimento, um lead novo ou um lead arquivado. Os cartões são atualizados sem recarregar a tela toda e sem piscar.
2. Também atualizar na hora quando o app volta para a frente (por exemplo, ao voltar de outro app no celular).
3. A visão do corretor continua como está hoje: ela já se atualiza na hora.

## Detalhes técnicos
- `usePipeline.ts`: quando `realtime=false`, criar um intervalo de 60s com consulta incremental: `updated_at > lastSyncAt`, com o mesmo escopo por papel e sem filtrar `arquivado`. Juntar por `id`. Remover da tela o que ficou arquivado ou foi para Descarte (`shouldHideLeadFromPipeline`). Guardar `lastSyncAt` com o maior `updated_at` recebido.
- A atualização ao voltar para o app usa a mesma função incremental, com intervalo mínimo de 15s entre buscas.
- Nada muda no banco nem nas regras de distribuição.

## Validação
- No preview, abrir a visão CEO. Alterar o lead de teste em outra sessão (mudar etapa e empreendimento). Conferir que a tela mostra a mudança em até 60s, sem recarregar.
- Conferir que a Marie aparece em Sem Contato com a busca "Golden lake".
