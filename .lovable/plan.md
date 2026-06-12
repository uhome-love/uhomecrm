# Adicionar Terrace ao S2 - Médio Padrão

## Situação atual
- O segmento **S2 - Médio Padrão** (na roleta) hoje tem apenas **Las Casas** ativo.
- O empreendimento **Terrace** (construtora Morana) já está mapeado no Jetimob (campaign_id `1713`), mas **não existe** em `roleta_campanhas`. Por isso, leads do Terrace caem no fallback (S3 - Avulso) em vez de ir para o S2.

## O que será feito
1. **Inserir "Terrace" no segmento S2 - Médio Padrão** da roleta (`roleta_campanhas`), com status ativo — passando a aparecer no card ao lado de "Las Casas".
2. **Alinhar o mapeamento Jetimob** (campaign_id 1713): ajustar o texto do segmento de `Médio-Alto` para `Médio-Alto Padrão` (nome exato em `pipeline_segmentos`), garantindo que `pipeline_leads.segmento_id` seja preenchido corretamente e não fique nulo.

## Validação
- Confirmar que "Terrace" aparece no card **S2 - Médio Padrão** junto de "Las Casas".
- Confirmar via consulta que a distribuição (`distribuir_lead_atomico`) resolve Terrace para S2 e não para o fallback.

## Observação técnica
Inserts/updates de dados (não mudança de schema):
- `roleta_campanhas`: novo registro `empreendimento='Terrace'`, `segmento_id='d364f084-a63b-4be3-892e-15d66e367b43'`, `ativo=true`.
- `jetimob_campaign_map`: `UPDATE` do campo `segmento` para `Médio-Alto Padrão` no campaign_id 1713.