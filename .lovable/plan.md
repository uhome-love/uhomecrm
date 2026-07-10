# Corrigir ingestão de leads da Meta em tempo real

## Problema
A contagem de leads diverge entre a Meta (4 Vivid hoje) e o CRM (2 Vivid) porque o webhook nativo da Meta falha em **100% das chamadas**. Os leads só chegam via cron de backfill (de hora em hora), com atraso.

## Causa-raiz (confirmada nos logs)
Em `supabase/functions/receive-meta-lead/index.ts`, a função `fetchMetaLead` (linha 128) inclui `form_name` na lista de campos pedidos à Graph API:

```
id,created_time,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,form_id,form_name,platform,field_data
```

`form_name` **não é um campo válido** no nó `leadgen`. A Graph API retorna erro `(#100) Tried accessing nonexisting field (form_name)`, e cada lead do weblook falha (`meta_native_webhook_partial`). O cron `meta-leads-backfill` já usa a lista correta (sem `form_name`, linha 174) — por isso ele funciona e é a única fonte que traz os leads.

## Correção

### 1. Remover `form_name` da busca do webhook nativo
Em `receive-meta-lead/index.ts`, linha 128, alinhar com o backfill:
```
const fields = "id,created_time,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,form_id,platform,field_data";
```
Isso restaura a ingestão em tempo real. O `form_name` não é essencial: o mapeamento de empreendimento já usa `campaign_name`. (Opcional, fora deste escopo: resolver o nome do formulário separadamente via `form_id`, como o backfill faz.)

### 2. Deploy da edge function
Fazer o deploy de `receive-meta-lead` para aplicar a correção.

### 3. Validação
- Confirmar via logs que novas chamadas do webhook passam a registrar `meta_native_webhook_ok` em vez de `meta_native_webhook_partial`.
- Confirmar que os 4 leads Vivid de hoje aparecem no CRM (2 já entraram pelo backfill; os outros 2 entram no próximo backfill ou no primeiro webhook bem-sucedido).
- Reauditar contagem por empreendimento (Meta vs CRM) para confirmar paridade.

## Impacto esperado
- Leads da Meta passam a entrar em segundos (tempo real), não mais só de hora em hora.
- A divergência de contagem desaparece assim que o backfill/webhook reconciliar o dia atual.
- Nenhuma mudança de schema, RLS ou frontend. Apenas 1 linha na edge function + deploy.

## Observação sobre os leads faltantes de hoje
Os 2 leads Vivid ainda não presentes no CRM são reais na Meta e entrarão automaticamente pelo backfill. Se desejar, posso forçar uma execução imediata do `meta-leads-backfill` após a correção para reconciliar o dia na hora.
