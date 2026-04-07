

## Corrigir erro "relation empreendimento_segmento does not exist" na distribuição

### Problema raiz
A RPC `distribuir_lead_atomico` referencia a tabela `public.empreendimento_segmento` que **não existe**. Isso faz com que TODA tentativa de distribuição falhe — tanto automática quanto manual (Fila do CEO).

O mapeamento empreendimento→segmento já existe na coluna `empreendimentos TEXT[]` da tabela `pipeline_segmentos`. A RPC precisa consultar essa coluna em vez de uma tabela inexistente.

### Solução
Uma única migration que recria a função `distribuir_lead_atomico`, substituindo a query:

```sql
-- ANTES (quebrado):
SELECT ps.id INTO v_segmento_id
FROM public.empreendimento_segmento es
INNER JOIN public.pipeline_segmentos ps ON ps.id = es.segmento_id
WHERE lower(trim(es.empreendimento)) = v_emp_lower
LIMIT 1;

-- DEPOIS (correto):
SELECT id INTO v_segmento_id
FROM public.pipeline_segmentos
WHERE ativo = true
  AND v_emp_lower = ANY(
    SELECT lower(trim(unnest(empreendimentos)))
  )
LIMIT 1;
```

Toda a restante lógica da função permanece idêntica. Nenhuma alteração no edge function ou no frontend é necessária.

### Resultado
- Distribuição volta a funcionar imediatamente
- Os 17+ leads na Fila do CEO poderão ser despachados
- Leads novos serão distribuídos automaticamente pelo trigger
