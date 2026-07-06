## Objetivo

Leads da campanha do Meta Ads com o formulário **"Uhome – Casa Menino Deus (CP)"** não podem entrar na roleta. Devem ser atribuídos **direto ao Bruno Schuler**, já no estado **aceito** (na carteira dele), sem passar por distribuição.

## Como funciona hoje

Todo lead do Meta chega em `receive-meta-lead`, é inserido em `pipeline_leads` com `corretor_id = null` e `aceite_status = "pendente_distribuicao"`, e em seguida é chamado `distributeLeadDirect(...)` (roleta). É exatamente esse ponto que precisamos interceptar para essa campanha específica.

## Mudança (somente na edge function `receive-meta-lead`)

1. **Detecção da campanha por nome de formulário**
   Após o parse do lead (já temos a variável `formName`), verificar se o nome do formulário corresponde a "Uhome – Casa Menino Deus (CP)". A comparação será tolerante (sem acentos, minúsculas, ignorando o traço/hífen e espaços) para não quebrar se o Meta enviar variações como `-`, `–`, `CP` etc. Isso define uma flag `atribuicaoDiretaBruno`.

2. **Inserção já atribuída**
   Quando `atribuicaoDiretaBruno` for verdadeiro, o lead é inserido com:
   - `corretor_id` = Bruno Schuler (`fb61ecda-5c4b-49d7-bda7-ccf9b589da07`)
   - `gerente_id` = gerente do Bruno (resolvido via `team_members`; se ele for o próprio gestor, mantém a referência dele / senão `null`)
   - `aceite_status = "aceito"`, `distribuido_em = now()`
   - `stage_id` = etapa inicial normal (mesma usada hoje)
   
   Toda a lógica de dedup existente continua valendo (telefone/e-mail), sem alteração.

3. **Pular a roleta**
   Quando a flag estiver ativa, **não** chamar `distributeLeadDirect`. Em vez disso, notificar o Bruno diretamente (registro em `notifications` + push via `send-push` + atividade de entrada no `pipeline_atividades`), reaproveitando o mesmo padrão de notificação já usado no código para leads reativados.

4. **Rastreabilidade**
   Registrar em `ops_events` um evento `lead_atribuido_direto_campanha` com o nome da campanha e o lead, para auditoria de que aquele lead pulou a roleta de propósito.

## Observações

- Nenhuma migração de banco é necessária — só código na edge function.
- Nada muda para as outras campanhas: elas continuam indo para a roleta normalmente.
- Se amanhã surgir outra campanha exclusiva, dá para transformar isso num pequeno mapa (`formulário → corretor`), mas por ora fica só para essa campanha do Bruno, como pedido.

## Detalhes técnicos

- Arquivo: `supabase/functions/receive-meta-lead/index.ts`.
- Match do formulário via função de normalização (reaproveitar `normalizeTimelineText` já existente) comparando contra o texto canônico `"uhome casa menino deus cp"`.
- `corretor_id` em `pipeline_leads` = `profiles.user_id` (auth id) — confirmado no banco (7.647 leads batem por `user_id`, 0 por `profiles.id`). Por isso usamos o auth id do Bruno.
</content>
<summary>Interceptar na edge function receive-meta-lead os leads do formulário "Uhome – Casa Menino Deus (CP)" e atribuí-los direto ao Bruno Schuler (já aceito), sem passar pela roleta.</summary>
</invoke>
