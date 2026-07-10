# Destravar reentrada do lead Meta (telefone 51992711372)

## Contexto
O telefone `51992711372` (lead `meta:1541347070723292`, gravado em `jetimob_processed` em 07/07/2026) está marcado como "já processado", mas **não existe nenhum card correspondente em `pipeline_leads`**. Isso faz o webhook da Meta descartar toda nova submissão com `skipped_permanent` (`telefone_em_jetimob_processed_sem_lead_ativo`), impedindo o lead de entrar no CRM e ser distribuído.

## Objetivo
Remover o registro órfão de `jetimob_processed` para que a próxima submissão da Meta (webhook ou backfill) recrie o lead normalmente e ele siga a distribuição padrão (roleta/fila).

## Ação
1. **Deletar o registro órfão** em `jetimob_processed`:
   - `jetimob_lead_id = 'meta:1541347070723292'` **e** `telefone = '51992711372'` (filtro duplo para não afetar nenhum outro registro).

2. **Reingerir/forçar reconciliação:** disparar o `meta-leads-backfill` para que o lead seja recriado imediatamente, em vez de esperar a próxima submissão espontânea.

3. **Validação:**
   - Confirmar que o registro sumiu de `jetimob_processed`.
   - Confirmar que um novo card do lead aparece em `pipeline_leads` após o backfill.
   - Confirmar que passou a ser atribuído (roleta/fila do CEO) e não caiu novamente em `skipped_permanent` nos `ops_events`.

## Observações
- Operação de dados pontual (um único registro), sem alteração de schema.
- Só remove o "carimbo" de processado — a deduplicação legítima por lead ativo continua intacta, já que não há card ativo com esse telefone.

## Detalhes técnicos
```sql
DELETE FROM jetimob_processed
WHERE jetimob_lead_id = 'meta:1541347070723292'
  AND telefone = '51992711372';
```
Em seguida, invocar a edge function `meta-leads-backfill` para reconciliar na hora.
