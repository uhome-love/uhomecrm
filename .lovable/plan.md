# Correção do CAPI (Meta) — plano

Nada será executado antes da sua aprovação. É 1 migration, aplicada fora do horário comercial (regra de no máximo 2 por dia entre 08h e 19h), e 1 ajuste na sincronização de públicos.

## O que muda

1. **Lead qualificado na primeira etapa avançada.** Hoje o evento só sai quando o lead entra exatamente em Qualificação. Passa a sair na **primeira** entrada em qualquer etapa de ordem 2 a 9 (Qualificação, Aquecimento, Visita, Pós-Visita, Documentação, Em Negociação, Contrato, Ganho). Só sai se o lead ainda não tiver esse evento na fila.
2. **Um evento por lead por etapa.** O identificador do evento passa a ser `md5(lead_id | nome_do_evento)`, sem o horário, igual à Lia. Se o identificador já existir, nada entra na fila.
3. **Origem padronizada.** O campo de origem passa a ser sempre `UhomeSales` (antes era "uhome" ou "Qualificado").
4. **Mais dados para o Meta reconhecer a pessoa.** Entra `external_id` = sha256 do id do lead. O CEP (`zp`) **já é enviado hoje** quando está preenchido, então fica como está.
5. **Públicos.** Cada sincronização passa a gravar `ultimo_total_enviado` com o total enviado naquela execução. Hoje esse campo nunca é preenchido.

## O que NÃO muda
Fila, `claim_meta_capi_batch`, função de envio, gatilhos de visita e venda, eventos da Lia, formulários e públicos que já existem. A trava "sem meta_lead_id/ctwa_clid não envia" e a janela de 7 dias continuam iguais.

## Arquivos e funções que serão alterados (lista completa)
- `public._trg_pipeline_lead_capi()`: nova regra de etapa (ordem 2–9 pela tabela `pipeline_stages`, sem id fixo), checagem `NOT EXISTS` na fila e `p_lead_event_source => 'UhomeSales'`. A proteção `EXCEPTION WHEN OTHERS` continua.
- `public.enqueue_meta_capi_event(...)`: mesma assinatura (sem criar segunda versão), default `'UhomeSales'`, novo `event_id` com `NOT EXISTS` antes de inserir e `external_id` no user_data.
- `supabase/functions/meta-audience-sync/index.ts`: incluir `ultimo_total_enviado: enviados` no update final.
- Não serão alterados: `_trg_visita_capi`, `_trg_negocio_capi`, `enqueue_meta_capi_event_lia`, `claim_meta_capi_batch`, a edge de envio e `capi_guarda_selftest` (vou só rodar esta última depois para conferir).

## Pontos de atenção (sugestões)
- **Efeito sobre visita e venda.** Os gatilhos de visita e venda não mudam, mas chamam a mesma função. Com o novo identificador, um cliente que remarca a visita gera **só 1** "VisitaMarcada" (hoje são 502 eventos para 384 clientes). Isso combina com "um evento por lead por etapa", mas reduz os números de visita no Meta. Se preferir manter remarcações, dá para aplicar o identificador sem horário só ao LeadQualificado.
- **Leads que já têm evento antigo.** Os eventos antigos usam o identificador com horário. A checagem do qualificado olha pelo nome do evento na fila, então não repete. Já visita e venda antigas não seriam reconhecidas pelo novo identificador e poderiam sair 1 vez a mais. Sugestão: para esses dois, checar também por `lead_id + event_name` na fila.
- **Origem.** Mudar para `UhomeSales` altera o valor que aparece no Meta. Se algum público ou relatório filtra por "Qualificado" ou "uhome", ele para de pegar os eventos novos. Hoje não achei esse filtro no código.
- **Sugestão extra:** também gravar `external_id` nos eventos da Lia (sha256 do id dela). Fica fora deste plano, porque você pediu para não mexer na Lia.

## Validação depois de aplicar
- Transação de teste com rollback: lead de teste com meta_lead_id passa de Sem Contato para Visita e gera 1 LeadQualificado. Ao voltar e avançar de novo, não gera um segundo.
- Conferir no payload: `external_id`, `zp` (quando há CEP) e origem `UhomeSales`.
- Rodar `capi_guarda_selftest`.
- Rodar uma sincronização de público e conferir `ultimo_total_enviado`.
- Nenhum lead real é alterado.
