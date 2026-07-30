## Objetivo

Permitir que a roleta registre no histórico o envio de um lead para a **Fila do CEO** quando não há corretor ativo/credenciado. Hoje `distribuicao_historico.corretor_id` é `NOT NULL` (confirmado no schema), então a `distribuir_lead_atomico` estoura exceção ao gravar `acao='fila_ceo'` com `corretor_id = NULL` e desfaz a marcação de pendência.

## Mudança

Uma única migration (apenas DDL):

1. `ALTER TABLE public.distribuicao_historico ALTER COLUMN corretor_id DROP NOT NULL;`
2. Constraint de integridade para não afrouxar demais: `corretor_id` pode ser nulo **somente** quando `acao = 'fila_ceo'`; nas demais ações continua obrigatório.

```sql
ALTER TABLE public.distribuicao_historico
  ADD CONSTRAINT distribuicao_historico_corretor_obrigatorio
  CHECK (corretor_id IS NOT NULL OR acao = 'fila_ceo');
```

Nenhuma tabela nova, portanto nenhum GRANT novo; RLS e policies existentes permanecem.

## Validação após aplicar

- Confirmar `is_nullable = YES` na coluna.
- Rodar um lead de teste sem corretor elegível (ou simular) e verificar que aparece linha com `acao='fila_ceo'`, `corretor_id IS NULL`, `motivo_pendencia='sem_alocado_produto'` no lead.
- Conferir que o lead fica em `aceite_status='pendente_distribuicao'` e aparece no painel **Leads Pendentes** (Fila do CEO), sem distribuição automática.

## Fora de escopo

- Nenhuma alteração na lógica de distribuição, no cron desligado de redistribuição ou no frontend.
- Nenhum backfill de registros históricos (as tentativas anteriores falharam e não deixaram linhas).

## Observação operacional

Regra de migrations: máx 2/dia entre 08–19h BRT. Esta é uma migration curta e sem lock pesado (DROP NOT NULL + CHECK valida a tabela); pode rodar quando você liberar.
