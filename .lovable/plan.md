

## Diagnóstico: Round-Robin distribuindo por LINHA em vez de por CORRETOR

### Causa raiz

Cada corretor tem **2 linhas** na `roleta_fila` (uma por segmento credenciado). Quando leads são "sem segmento" (`v_ignora_segmento = true`), a query do round-robin considera TODAS as linhas como elegíveis.

O problema está na linha 329-332 da função `distribuir_lead_atomico`:

```sql
UPDATE public.roleta_fila
SET leads_recebidos = leads_recebidos + 1,
    ultima_distribuicao_at = v_now
WHERE id = v_chosen_fila_id;  -- ← só atualiza UMA linha
```

Isso só atualiza a linha específica escolhida. A OUTRA linha do mesmo corretor continua com `ultima_distribuicao_at = NULL`, fazendo com que o round-robin a escolha novamente na próxima iteração.

**Sequência real com 8 leads (todos sem segmento):**
1. Junior (linha segmento-A, NULL) → recebe lead 1, atualiza para T1
2. Junior (linha segmento-B, NULL) → recebe lead 2, atualiza para T2
3. Cássio (linha segmento-A, NULL) → recebe lead 3
4. Cássio (linha segmento-B, NULL) → recebe lead 4
5. Thalia → lead 5, 6
6. Ebert → lead 7, 8

Resultado: 4 corretores com 2 cada, em vez de 8 corretores com 1 cada.

### Correção

Na função `distribuir_lead_atomico` e no trigger `trg_auto_distribute_lead`, trocar o UPDATE pontual por um UPDATE que atualiza **TODAS** as linhas do mesmo corretor no mesmo dia:

```sql
-- ANTES (bug):
UPDATE public.roleta_fila
SET leads_recebidos = leads_recebidos + 1,
    ultima_distribuicao_at = v_now
WHERE id = v_chosen_fila_id;

-- DEPOIS (fix):
UPDATE public.roleta_fila
SET leads_recebidos = leads_recebidos + 1,
    ultima_distribuicao_at = v_now
WHERE id = v_chosen_fila_id;

-- Sincronizar timestamp em TODAS as linhas do mesmo corretor
UPDATE public.roleta_fila
SET ultima_distribuicao_at = v_now
WHERE data = v_today_date
  AND corretor_id = v_chosen_profile_id
  AND id <> v_chosen_fila_id;
```

Isso garante que, após receber 1 lead, o corretor "vai para o fim da fila" em TODAS as suas linhas de segmento, independente de qual foi selecionada.

### Alteração necessária

**Uma migração SQL** que recria `distribuir_lead_atomico` e `trg_auto_distribute_lead` com o fix acima. Nenhuma alteração de código frontend necessária.

### Impacto

- Corrige distribuição para ser 1-por-corretor antes de repetir
- Funciona tanto para leads com segmento (escolhe a linha do segmento correto) quanto sem segmento (todas as linhas elegíveis)
- 13 corretores ativos na manhã de hoje: 8 leads seriam distribuídos 1 para cada um dos 8 primeiros no round-robin

