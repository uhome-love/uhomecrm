# Lia · Fase 1 (webhook + cron) e a confirmação do edge-health-alert

## Resposta à pergunta do edge-health-alert

Verificado no código da função: **não existe nenhuma checagem além do que o gateway faz**. A função não valida segredo, não valida JWT, não confere origem — o próprio cabeçalho do arquivo diz `verify_jwt=false, sem validação custom`. Ou seja, a leitura está certa e é pior do que "chave pública": qualquer pessoa que descubra a URL consegue executar a função. O problema é **execução não autorizada**, não confidencialidade. Ela entra no sweep por esse motivo.

Mitigação atual (não é defesa, é limitação de dano): a função é idempotente, tem dedup de 24h por function alertada e não expõe dado sensível na resposta. O pior efeito de um abuso é ruído de notificação e consumo.

## O que vai ser feito na Fase 1

1. `lia-webhook` — recebe eventos da instância `uhome-lia-canoas`, valida segredo próprio por header (401 quando faltar ou não bater), grava em `ia_leads` / `ia_mensagens` e nunca escreve no pipeline. Sem chamada ao modelo.
2. Filtro de captura — só processa o que estiver nas listas de `ia_config.captura_lia`. As listas nascem **vazias**, então na prática nada é capturado até o número entrar.
3. `lia-cron` — varredura periódica de follow-ups pendentes, sem enviar nada enquanto `enviar_habilitado = false`.
4. Agendamento do cron lendo o segredo do cofre, com **segredo próprio `lia_cron_secret`** (não reaproveita o do CAPI — raio de dano separado). Nenhuma chave de projeto em texto na definição do job.
5. Interruptores permanecem como fecharam na Fase 0: kill switch geral ativo, envio desabilitado, shadow mode só na Fase 2.

## O portão da Fase 1

A Fase 1 **sobe hoje mas não fecha hoje**. O fechamento depende do teste de fumaça com o chip novo e dedicado conectado na instância `uhome-lia-canoas`: mensagem real entra, aparece em `ia_mensagens` com o vínculo certo, e nada sai. Sem o número, nada de `captura_lia` é preenchido.

## Backlog de segurança (sweep único, fora desta fase)

- `edge-health-alert-1h`: adicionar validação de segredo de cron por header e trocar a chave literal do job por leitura do cofre. Motivo: execução não autorizada.
- Demais crons HTTP com `verify_jwt=false` sem validação custom, no mesmo padrão.

## Depois da Fase 1

Escolher o modelo, subir as quatro peças de mídia, rodar a bateria de 20 para gravar a linha de base — itens 16 a 18 são gate duro — e só então a Lia atende em modo sombra.
