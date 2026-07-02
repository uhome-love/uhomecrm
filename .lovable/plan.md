# Corrigir prévia "S3 - Avulso" → "S1 - Moradia" na Fila CEO

## Contexto
As edições da rodada anterior não persistiram — o arquivo `FilaCeoDispatchModal.tsx` voltou ao estado original com o rótulo hardcoded `SEG_AVULSO = "S3 - Avulso"`. Por isso os leads ImovelWeb/Site e leads sem match de campanha ainda aparecem como **S3 - Avulso** na prévia por segmento.

O dado real está correto: a função `distribuir_lead_atomico` roteia ImovelWeb/Site para **S1 - Moradia** (`v_avulso_segmento_id = 9948… S1 Moradia`). O problema é apenas o rótulo cosmético da prévia no modal.

## Alteração (único arquivo)
`src/components/pipeline/FilaCeoDispatchModal.tsx`

1. Trocar a constante: `SEG_AVULSO = "S3 - Avulso"` → `SEG_MORADIA = "S1 - Moradia"` (atualizar usos).

2. Em `resolveSegmentoNome`, alinhar ao backend:
   - Roteamento explícito por origem no início: se `origem` contém `imovelweb` ou `site` → retornar `"S1 - Moradia"`.
   - Fallback universal (sem match de campanha) → retornar `"S1 - Moradia"` em vez de `"S3 - Avulso"`.

3. Atualizar o mapa `SEGMENTO_COLORS` para os 4 segmentos canônicos atuais:
   - `S1 - Moradia`, `S2 - Investimento`, `S3 - Foco`, `S4 - Alto Padrão` (remover chaves antigas "S1 - MCMV / Médio Padrão", "S2 - Alto Padrão", "S3 - Avulso", "S4 - Investimento").

## Fora de escopo
- Não alterar banco de dados, funções, RLS nem edge functions (distribuição real já correta).

## Resultado esperado
A prévia da Fila CEO mostra **S1 - Moradia** para leads ImovelWeb/Site e para qualquer lead sem match de campanha, batendo com o destino real ao disparar.
