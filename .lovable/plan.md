

## Diagnóstico: Timeout na Edge Function ao disparar 24 leads

### Causa raiz

A Edge Function `distribute-lead` processa cada lead **sequencialmente**, fazendo ~4-5 queries por lead (timeout history, update, insert distribuição, insert notification, etc.). Com 24 leads, são ~100+ queries sequenciais, excedendo o limite de tempo de execução (~25s para Edge Functions).

Os logs confirmam: a função iniciou às 17:16:03, processou apenas 2 leads (John Moura e Julissa Mello), e nunca logou "Dispatch complete".

### Solução: Processar leads em paralelo com batches

**Arquivo**: `supabase/functions/distribute-lead/index.ts`

1. **Agrupar leads em mini-batches de 5** e processar cada batch em paralelo com `Promise.all`
2. **Remover `await` desnecessários** nas inserções secundárias (notifications, roleta_distribuicoes, audit_log) — usar fire-and-forget
3. **Otimizar a query de timeouts**: em vez de fazer 1 query por lead para buscar timeouts anteriores, fazer uma única query para todos os lead IDs de uma vez

### Mudanças técnicas

```text
ANTES (sequencial):
  for (lead of 24 leads) {
    await queryTimeouts(lead)     // ~200ms
    await updateLead(lead)        // ~200ms  
    await insertDistribuicao()    // ~200ms
    await insertNotification()    // ~200ms
    await sendWhatsApp()          // ~300ms
  }
  Total: ~24 × 1100ms = ~26s (TIMEOUT!)

DEPOIS (otimizado):
  // 1 query para todos os timeouts de uma vez
  allTimeouts = await queryTimeoutsForAllLeads(leadIds)
  
  // Processar em batches de 5 em paralelo
  for (batch of chunks(leads, 5)) {
    await Promise.all(batch.map(lead => {
      await updateLead(lead)        // essencial - await
      // fire-and-forget para o resto
      insertDistribuicao()
      insertNotification()
      sendWhatsApp()
    }))
  }
  Total: ~5 batches × 400ms = ~2s
```

### Alterações específicas no arquivo

1. **Linha ~288-295**: Mover a query de `distribuicao_historico` (timeouts) para FORA do loop — buscar todos os timeouts de todos os `leadIds` de uma vez e indexar por `pipeline_lead_id`

2. **Linha ~283-403** (loop principal): Substituir o `for` sequencial por processamento em chunks de 5 com `Promise.all`, mantendo `await` apenas no `update` do pipeline_leads

3. **Linhas 373-399**: Remover `await` dos inserts de `roleta_distribuicoes`, `notifications`, e chamadas de WhatsApp/Push (já são fire-and-forget mas têm `await` desnecessário em alguns)

Nenhuma migration SQL necessária — apenas otimização da Edge Function.

