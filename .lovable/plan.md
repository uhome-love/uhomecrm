

## Corrigir leads do site que ficam invisíveis quando arquivados

### Problema
Quando um lead já existente e arquivado (`arquivado = true`) interage novamente pelo site, o sistema encontra o lead por deduplicação de telefone e atualiza os dados, mas **não desativa a flag `arquivado`**. O lead fica atualizado no banco mas invisível no pipeline, porque todas as queries filtram `arquivado = false`.

Isso acontece em **dois lugares**:
1. **Edge function `crm-webhook`** (linha 232-243) — update do dedup não inclui `arquivado: false`
2. **Trigger SQL `sync_site_lead_to_pipeline`** (linha 32-47) — mesma omissão

### Correção

**1. Edge function `crm-webhook/index.ts`** (linha 232-243)

Adicionar `arquivado: false` e mover o lead de volta para o stage "Novo Lead" no bloco de update do lead existente:

```typescript
await supabase
  .from('pipeline_leads')
  .update({
    arquivado: false,                    // ← NOVO: desarquivar
    stage_id: NOVO_LEAD_STAGE_ID,        // ← NOVO: voltar para Novo Lead
    stage_changed_at: new Date().toISOString(),
    dados_site: record,
    tipo_acao: tipo,
    origem_ref: origemRef,
    imovel_codigo: imovelCodigo || undefined,
    imovel_url: imovelUrl || undefined,
    observacoes: updateObsParts.join(' | '),
    updated_at: new Date().toISOString(),
  })
  .eq('id', existingLead.id)
```

**2. Trigger SQL `sync_site_lead_to_pipeline`**

Nova migration para adicionar `arquivado = false` e reset de stage no bloco de UPDATE do dedup (linha 32-47):

```sql
UPDATE pipeline_leads SET
  arquivado = false,
  stage_id = v_stage_id,
  stage_changed_at = now(),
  dados_site = ...,
  observacoes = ...,
  updated_at = now()
WHERE id = v_existing_id;
```

### Resultado
Todo lead do site que reentrar — mesmo que tenha sido descartado/inativado anteriormente — volta automaticamente para "Novo Lead" visível no pipeline, sem exceção.

