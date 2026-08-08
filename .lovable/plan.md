# Lia · Fase 1 — captura, desvio e webhook

Descrição anterior estava incompleta. Esta substitui e recupera o escopo aprovado.

## Antes de subir: a versão do Evolution

O que dá para afirmar pelo código: as funções atuais registram webhook com o payload aninhado `{ webhook: { enabled, url, events } }` em `POST /webhook/set/{instancia}`, que é o formato da linha 2.x do Evolution. O formato antigo (campos planos) não é usado em lugar nenhum do projeto. Isso é indício forte de v2, **não é confirmação da versão exata** — e é a versão exata que decide se `webhook.headers` é honrado.

Por isso o primeiro passo executável da Fase 1, antes de registrar qualquer webhook, é consultar o endpoint de versão do próprio servidor com as credenciais já existentes (`EVOLUTION_API_URL` / `EVOLUTION_API_KEY`) e registrar o resultado. Decisão amarrada ao retorno:

- **Suporta header customizado**: header como principal, query string como reserva. Ambos aceitos, qualquer um válido passa.
- **Não suporta**: query string como principal, header aceito quando vier. Nada de 401 por ausência de header.

Nos dois casos vale a mesma regra final: além do segredo, **checagem do nome da instância** no corpo do evento — só `uhome-lia-canoas` é aceita. Evento de outra instância é descartado com 200, não com 401, para não poluir o retry do Evolution.

## Escopo da Fase 1

1. **Desvio na entrada do lead da campanha.** `receive-meta-lead` e `meta-leads-backfill` passam a consultar `ia_config.captura_lia` antes de gravar. Se `campaign_id` (ou `form_id`) casar com a lista, o lead **não** vai para `pipeline_leads` nem para a roleta: vai para `ia_leads`, já com `meta_lead_id`, `campaign_id` e `form_id` gravados, para não esbarrar na guarda do CAPI depois. Se o `campaign_id` casar mas o `form_id` for desconhecido, grava mesmo assim e emite alerta.
2. **Checagem de telefone na entrada, três desfechos.** Antes de criar em `ia_leads`:
   - telefone já existe no pipeline como lead ativo → segue o caminho normal do pipeline, a Lia não assume, registra o motivo;
   - telefone consta em opt-out (`meta_supressao` por `telefone_last8`, e `base_leads.opt_out_motivo`) → entra em `ia_leads` já com etapa `bloqueado`, sem nenhum envio;
   - telefone inédito → entra em `ia_leads` na etapa de entrada.
3. **Poll da Graph API a cada minuto, como rede de segurança.** `lia-cron` consulta os formulários da campanha da Lia por leads recentes e cria o que o webhook do Meta tiver perdido. Idempotente por `meta_lead_id` — reprocessar não duplica.
4. **`lia-webhook`** — recebe os eventos de mensagem do Evolution da instância `uhome-lia-canoas`, com o esquema de segredo decidido acima, grava em `ia_mensagens` vinculado ao `ia_leads`, e **não escreve nada no pipeline**. Nenhuma chamada ao modelo nesta fase.
5. **Agendamento do cron pelo cofre**, com segredo próprio `lia_cron_secret` — não reaproveita o do CAPI, para manter raio de dano separado. Nenhuma chave de projeto em texto na definição do job.
6. **Interruptores como fecharam a Fase 0**: kill switch geral ativo, `enviar_habilitado = false`, `captura_lia` com as listas **vazias**. Com as listas vazias, o desvio existe no código mas não desvia nada — o comportamento de hoje continua idêntico até alguém preencher.

## O portão

A Fase 1 sobe hoje e **não fecha hoje**. O fechamento é o teste de fumaça com o chip novo e dedicado conectado na instância `uhome-lia-canoas`: mensagem real entra, aparece em `ia_mensagens` com o vínculo certo, nada sai, e um lead de teste da campanha cai em `ia_leads` em vez de na roleta. Sem o número, `captura_lia` fica vazia.

## Backlog de segurança (sweep separado)

`edge-health-alert-1h` não tem nenhuma checagem além do gateway — confirmado no código, o próprio cabeçalho diz `verify_jwt=false, sem validação custom`. Classificação: execução não autorizada. Entra no sweep junto com os demais crons HTTP no mesmo padrão.

## Depois da Fase 1

Escolher o modelo, subir as quatro peças de mídia e rodar a bateria de 20 para gravar a linha de base — itens 16 a 18 são gate duro. Só então a Lia atende em modo sombra.
