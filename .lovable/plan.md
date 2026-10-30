# CAPI: envio único do passado (16 clientes)

## Quem entra
Entram os clientes que cumprem as três condições:
- Têm o identificador do anúncio do Meta.
- Entraram pela **primeira vez em todo o histórico** numa destas etapas nos últimos 6 dias: Qualificação, Aquecimento, Visita, Pós-Visita, Documentação, Em Negociação, Contrato ou Ganho.
- Ainda não têm o evento de lead qualificado na fila (pendente, em envio ou enviado).

Conferi agora e são **16**, igual à sua conta. Os 8 que já tinham passado por essas etapas antes dos 6 dias ficam de fora.

## Como será feito
- Cada evento entra na fila com a data real dessa primeira entrada na etapa e com a origem "UhomeSales".
- Isso é feito pela mesma função que o sistema usa hoje, então valem as mesmas travas: um evento por cliente e só para quem tem identificador do anúncio.
- Nenhum cliente, etapa ou corretor é alterado. Só entram eventos novos na fila de envio para o Meta.

## Depois
- Confirmo quantos eventos entraram na fila (o esperado é 16).
- Marco a tarefa como concluída na lista de tarefas.

## Detalhes técnicos
O cálculo usa `min(pipeline_historico.created_at)` por cliente, considerando todo o histórico e só as etapas de `pipeline_stages.tipo` acima. Entra quem tem esse mínimo maior que `now() - 6 dias`, tem `meta_lead_id` preenchido e não tem `LeadQualificado` com status `pending`, `processing` ou `sent`. Para cada um, roda `enqueue_meta_capi_event(lead, 'LeadQualificado', p_event_time => mínimo, p_lead_event_source => 'UhomeSales')` em um único `supabase--run_sql`.
