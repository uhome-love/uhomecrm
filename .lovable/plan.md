# Correção do CAPI (Meta): plano com os seus ajustes

Este plano já inclui os ajustes que você pediu. A migration será aplicada agora, fora do horário comercial.

## O que muda

1. **Lead qualificado na primeira etapa avançada.** O evento sai na **primeira** vez que o lead entra em uma destas etapas: Qualificação, Aquecimento, Visita, Pós-Visita, Documentação, Em Negociação, Contrato ou Ganho. O sistema reconhece a etapa pelo tipo dela, e não pela posição no quadro. Se o lead já tiver esse evento na fila, nada sai.
2. **Um evento por lead em todos os tipos de evento.** O código de cada evento deixa de usar o horário e passa a ser montado com o cliente e o nome do evento. Antes de colocar na fila, o sistema confere se aquele cliente já tem aquele evento lá. Isso cobre também os eventos antigos.
   - **Exceção para Venda:** o código usa o cliente, a palavra "Venda" e o negócio. A conferência é feita pelo negócio, então o mesmo cliente pode gerar mais de uma compra.
3. **Origem padronizada.** A origem de todos os eventos passa a ser sempre `UhomeSales`.
4. **Mais dados para o Meta reconhecer a pessoa.** Entra um código protegido do cliente (o id do lead criptografado). O CEP já é enviado hoje quando está preenchido, então continua igual.
5. **Públicos.** Cada sincronização passa a guardar quantos contatos foram enviados naquela vez.

## Envio único do passado (depois da migration)
- **Quem entra:** clientes com identificador do anúncio do Meta que entraram numa das etapas acima nos últimos 6 dias, segundo o histórico do cliente, e que ainda não têm o evento de lead qualificado na fila.
- **Data:** cada evento vai com o momento real em que o cliente mudou de etapa.
- **Antes de enfileirar,** te mostro quantos são e só sigo com o seu ok.

## O que NÃO muda
Continuam iguais: a fila, `claim_meta_capi_batch`, a função de envio, os gatilhos de visita e venda, os eventos da Lia, os formulários e os públicos que já existem. A trava "sem identificador do anúncio não envia" e o limite de 7 dias também ficam como estão.

## Funções e arquivos alterados (lista completa)
- `public._trg_pipeline_lead_capi()`: identifica a etapa por `pipeline_stages.tipo IN ('qualificacao','aquecimento','visita','pos_visita','documentacao','proposta','contrato_gerado','venda')`, confere `NOT EXISTS` por lead_id + 'LeadQualificado' e usa `p_lead_event_source => 'UhomeSales'`. A proteção `EXCEPTION WHEN OTHERS` continua.
- `public.enqueue_meta_capi_event(...)`: mantém a mesma assinatura e o default passa a ser `'UhomeSales'`.
  - Código do evento: `md5(lead_id|event_name)`, com `NOT EXISTS` por lead_id + event_name.
  - Na Venda: `md5(lead_id|'Venda'|negocio_id)`, com `NOT EXISTS` por `payload->'custom_data'->>'negocio_id'`. O negocio_id já chega hoje pelo gatilho de venda, sem precisar mexer nele.
  - Inclui `external_id` = sha256 do id do lead.
- `supabase/functions/meta-audience-sync/index.ts`: o update final passa a incluir `ultimo_total_enviado: enviados`.
- Não serão alterados: `_trg_visita_capi`, `_trg_negocio_capi`, `enqueue_meta_capi_event_lia`, `claim_meta_capi_batch`, a edge de envio e `capi_guarda_selftest` (esta última só será executada para conferência).

## Validação (transações de teste desfeitas no final, sem tocar em cliente real)
- Um cliente de teste com identificador do anúncio sai de Sem Contato e vai para Visita: gera 1 evento de lead qualificado. Volta e avança de novo: continua com 1.
- O cliente de teste vai para Visita, volta e tem a visita remarcada: continua com 1 só evento de visita marcada na fila.
- 2 negócios ganhos do mesmo cliente geram 2 eventos de Venda.
- Conferir no conteúdo enviado: o código protegido do cliente, o CEP (quando houver) e a origem `UhomeSales`.
- Executar `capi_guarda_selftest`.
- Rodar uma sincronização de público e conferir se o total enviado foi gravado.
