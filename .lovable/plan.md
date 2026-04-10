

## Diagnóstico: Round-Robin ainda distribui múltiplos leads ao mesmo corretor

### Causa raiz confirmada

Quando um lead é "segmento geral" (Casa Tua, site, imovelweb), a query na função `distribuir_lead_atomico` aceita TODAS as linhas da `roleta_fila` (qualquer segmento). Um corretor credenciado em 2 segmentos tem 2 linhas elegíveis.

O `ORDER BY rf.ultima_distribuicao_at ASC NULLS FIRST, rc.created_at ASC LIMIT 1` pode selecionar o mesmo corretor repetidamente porque:
1. Ambas as linhas têm `NULL` timestamp inicialmente
2. O desempate por `rc.created_at` favorece sempre o mesmo corretor
3. Embora o timestamp sync atualize ambas as linhas, na execução em batch rápido (CEO dispatch), o advisory lock serializa mas o `now()` de cada transação é ligeiramente diferente, e a próxima iteração ainda pode pegar o mesmo corretor se o desempate favorece

### Dados de hoje (manhã)
- 13 corretores credenciados, 9 com `na_roleta=true`
- 9 leads distribuídos → apenas 5 corretores receberam (Junior: 2, Cássio: 2, Thalia: 2, Ebert: 2, Taynah: 1)
- Anderson, Jéssica, Paula, Rafaela, Samuel não receberam nada

### Correção

**Uma migração SQL** que recria `distribuir_lead_atomico` e `trg_auto_distribute_lead` com a seguinte mudança na query de seleção (ATTEMPT 1 e trigger):

Trocar:
```sql
SELECT rf.id, p.id, p.user_id
FROM roleta_fila rf ...
ORDER BY rf.ultima_distribuicao_at ASC NULLS FIRST, rc.created_at ASC
LIMIT 1;
```

Por:
```sql
SELECT sub.fila_id, sub.profile_id, sub.auth_id
FROM (
  SELECT DISTINCT ON (rf.corretor_id)
    rf.id AS fila_id,
    p.id AS profile_id,
    p.user_id AS auth_id,
    rf.corretor_id,
    rf.ultima_distribuicao_at,
    rc.created_at AS cred_created
  FROM roleta_fila rf
  INNER JOIN roleta_credenciamentos rc ON rc.id = rf.credenciamento_id
  INNER JOIN profiles p ON p.id = rf.corretor_id
  LEFT JOIN corretor_disponibilidade cd ON cd.user_id = p.user_id
  WHERE [mesmos filtros atuais]
  ORDER BY rf.corretor_id, rf.ultima_distribuicao_at ASC NULLS FIRST
) sub
ORDER BY sub.ultima_distribuicao_at ASC NULLS FIRST, sub.cred_created ASC
LIMIT 1;
```

O `DISTINCT ON (rf.corretor_id)` garante que cada corretor aparece **apenas uma vez** na lista de candidatos, eliminando duplicatas de múltiplos segmentos. Depois o `ORDER BY` externo faz o round-robin normal.

Mesma correção aplicada em:
- ATTEMPT 1 (distribuição normal)
- ATTEMPT 2 (force/CEO fallback)
- `trg_auto_distribute_lead` (trigger automático)

### Impacto
- 13 corretores ativos, 13 leads → 1 para cada
- Funciona para segmento específico (1 linha elegível por corretor = sem mudança)
- Funciona para segmento geral (dedup por corretor garante 1-a-1)
- Nenhuma alteração de frontend necessária

