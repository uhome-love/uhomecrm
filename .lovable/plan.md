# Corrigir prévia "S3 - Avulso" na Fila CEO

## Contexto
O lead ImovelWeb parado na Fila CEO aparece como **S3 - Avulso** na prévia por segmento, mas isso é apenas um rótulo desatualizado no frontend. No banco o lead já está em **S1 - Moradia**, e a função de distribuição (`distribuir_lead_atomico`) roteia ImovelWeb/Site corretamente para S1 - Moradia. Nenhuma mudança de banco ou de lógica de distribuição é necessária.

## Objetivo
Fazer a prévia por segmento do modal refletir o comportamento real do backend, eliminando o rótulo antigo "S3 - Avulso".

## Alteração (único arquivo)
`src/components/pipeline/FilaCeoDispatchModal.tsx`

1. Trocar a constante de fallback:
   - de `const SEG_AVULSO = "S3 - Avulso";`
   - para `const SEG_MORADIA = "S1 - Moradia";` (renomear usos)

2. Em `resolveSegmentoNome`, alinhar ao backend:
   - Adicionar roteamento explícito por origem no início: se `origem` contém `imovelweb` ou `site` → retornar `"S1 - Moradia"`.
   - Trocar o fallback universal (lead sem match de campanha) para retornar `"S1 - Moradia"` em vez de `"S3 - Avulso"`.

3. Atualizar o mapa de cores `SEGMENTO_COLORS`: substituir a chave `"S3 - Avulso"` por `"S1 - Moradia"` (mantendo/ajustando a cor apropriada para o segmento de Moradia).

## Fora de escopo
- Não alterar banco de dados, funções, RLS nem edge functions.
- Não mexer na lógica real de distribuição (já correta).
- A referência residual "S3 - Avulso" em `RoletaCampanhasPanel.tsx` é apenas um fallback de cor inofensivo; pode ser atualizada opcionalmente, mas não é necessária para resolver o problema relatado.

## Resultado esperado
A prévia da Fila CEO mostrará **S1 - Moradia** para leads ImovelWeb/Site e para qualquer lead sem match de campanha, batendo com o destino real ao disparar.
