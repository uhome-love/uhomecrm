## Objetivo
Fazer uma conferência completa dos leads descartados e corrigir a central para mostrar a base real, separando claramente:
- descartados totais
- inativados definitivos (responderam não / não receber)
- elegíveis para reengajamento
- impacto de arquivamento, telefone e deduplicação

## Diagnóstico já confirmado
Hoje o número baixo do preview não vem de falta de leads; vem do filtro atual da função de preview:
- a função `reengajamento-audience-preview` usa `arquivado = false` para descartados
- no banco existem **2873** leads em Descarte
- desses, **2825** estão `arquivado = true`
- só **48** estão `arquivado = false`
- com telefone, temos **2868** no total e **48** não arquivados
- descartados reengajáveis totais: **2416**
- descartados reengajáveis com telefone: **2412**
- respondeu NÃO ao reengajamento: **232**
- `tipo_descarte = definitivo`: **457**

Ou seja: o preview atual está mostrando praticamente só o subconjunto “não arquivado”, e por isso aparece ~46/48 em vez de milhares.

## Plano
### 1) Criar a conferência completa dos descartados
Adicionar uma visão/auditoria única para descartados com estes blocos:
- total em Descarte
- total sem inativados definitivos
- total com telefone
- total arquivado vs não arquivado
- total que respondeu NÃO ao reengajamento
- total com `tipo_descarte = definitivo`
- total elegível final para disparo por regra atual
- total elegível final por regra revisada

### 2) Separar conceitos que hoje estão misturados
Ajustar a leitura para distinguir:
- **Arquivado**: lead oculto operacionalmente, mas não necessariamente inelegível para nutrição
- **Inativado definitivo**: lead que respondeu não / pediu para não receber / `tipo_descarte = definitivo`
- **Reengajável**: descartado que não está inativado definitivamente e tem telefone

### 3) Revisar a regra de elegibilidade do público “Descartados”
Alterar a regra do preview para que “Descartados” não dependa de `arquivado = false` como filtro-base.
Nova lógica proposta:
- incluir descartados arquivados e não arquivados
- excluir apenas inativados definitivos quando o objetivo for “reengajáveis”
- manter filtros opcionais de período, empreendimento, dedup e telefone

### 4) Incluir relatório explicativo dentro da Central de Reengajamento
Na página única da central, adicionar um resumo visível com:
- contagem bruta
- contagem após excluir inativados
- contagem após exigir telefone
- contagem após dedup
- amostra dos leads finais

Assim o usuário vê exatamente onde cada redução acontece.

### 5) Validar com consultas espelho
Depois do ajuste, validar o resultado comparando:
- query de auditoria
- resultado do preview da edge function
- número exibido no card da central

Os três precisam bater.

## Arquivos previstos
- `supabase/functions/reengajamento-audience-preview/index.ts`
- `src/components/central-nutricao/DisparoCustomizadoCard.tsx`
- `src/pages/CentralNutricao.tsx`

## Detalhes técnicos
- manteremos a exclusão de telefone nulo
- manteremos dedup configurável (`exclude_sent`, `include_all`, `only_sent_before`)
- a conferência vai expor as etapas do funil de filtragem, para não parecer que os leads “sumiram”
- não vou mexer na rota de resposta dos webhooks nesta etapa; foco é conferência e elegibilidade do público descartados

## Resultado esperado
Ao final, a central vai mostrar algo próximo da base real de milhares de descartados reengajáveis, em vez de apenas ~46, e vai deixar explícito quantos foram cortados por:
- inativação definitiva
- falta de telefone
- deduplicação
- outros filtros manuais