# Por que só 872 saíram de 5.000 — e como corrigir

## Diagnóstico (confirmado nos dados da run)

A run em andamento (`111e9787…`, template `casatua_novidadeterraco`) gravou esta auditoria:

```text
total_bruto ............ 1.000   <-- teto
- supressão Meta ....... 113
- telefones inválidos ... 15
= enfileirados ......... 872
```

O público não encolheu por filtro de higiene: ele nunca passou de **1.000**. O motivo é o teto de linhas do PostgREST: mesmo pedindo 5.000 (o backend chega a pedir o dobro, 10.000), qualquer resposta da API é cortada em 1.000 linhas por requisição.

Detalhe: a fonte "Base Única" é buscada por uma chamada única de RPC (`selecionar_reengajamento_base`) **sem paginação**, diferente da fonte "Oferta Ativa", que já busca em páginas de 1.000. Por isso a Base Única sempre trava em 1.000 brutos → ~870 enfileirados, independentemente de você digitar 5.000.

A prévia ("5.000 elegíveis") usa uma contagem no banco, que não sofre esse corte — daí a diferença entre o que a tela promete e o que entra na fila.

## Correção

1. **Paginar a busca da Base Única** no disparo: buscar em páginas de 1.000 até atingir o limite pedido (ou acabar a base), no mesmo padrão já usado na fonte Oferta Ativa.
2. **Deduplicar enquanto pagina** (por id e pelos últimos 8 dígitos do telefone), necessário porque a ordenação "aleatório" pode repetir registros entre páginas.
3. **Aplicar o mesmo conserto na fonte "Pipeline ativo"**, que hoje também faz uma busca única com o mesmo teto.
4. **Deixar rastro na auditoria**: registrar quantas páginas/linhas brutas vieram, para que um corte futuro fique visível na aba Histórico.

## O que fazer com o disparo atual

O disparo de agora continua rodando normalmente com os 872 (nada é perdido nem duplicado). Depois do ajuste, é só rodar um novo disparo com o mesmo público: a higiene de "já disparado" exclui automaticamente esses 872, e o restante da base entra.

## Detalhe técnico

- Arquivo: `supabase/functions/reengajamento-descartados-enqueue/index.ts`, funções `fetchBaseUnica` e `fetchPipelineAtivo`.
- Trocar a chamada única por laço com `.range(off, off + 999)` até `cap`, parando quando a página vier incompleta.
- Sem migration; a RPC já aceita `p_limit` alto e a ordenação já é determinística nos modos "recentes"/"antigos".
- Sem mudança de frontend e sem publish.
