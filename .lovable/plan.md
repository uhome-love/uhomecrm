# Habilitar o template `awa_disparo2` no Reengajamento

## Estado atual (verificado)

- O template novo se chama **`awa_disparo2`** e na Meta está **"Em análise"** (aguardando aprovação). A Central de Reengajamento só lista templates com status **APPROVED**, então ele ainda não aparece para seleção — isso é da Meta, não do CRM.
- O mapa de artes no CRM tem apenas `awa_reengajamento_v1`; não há imagem para `awa_disparo2` (o header viria vazio).
- O rótulo de produto já funciona: a regra de "awa" reconhece `awa_disparo2` e marca o lead como **AWA** na Fila do CEO quando ele responde "Sim, quero mais informações".
- O empreendimento **AWA** já está cadastrado e ativo.
- Nada bloqueado: o template não está na lista de bloqueados e a Central não está pausada.

## O que vou fazer

1. **Subir a arte** anexada para o bucket público de imagens de campanha como `campaign-images/reengajamento/awa-disparo2.jpg`.
2. **Mapear template → imagem**: ao escolher `awa_disparo2` na Central, o header já vem preenchido sozinho (sem colar link na mão).
3. **Validar ao vivo** em `/central-nutricao`: abrir o seletor de templates e conferir o estado do `awa_disparo2`. Enquanto a Meta não aprovar, ele não aparece na lista — nesse caso confirmo que tudo está pronto e que basta a aprovação chegar. **Sem disparar nada.**

## Observação importante

O uso real só libera quando a Meta mudar o status de "Em análise" para "Ativo/Aprovado". Quando isso acontecer, o template aparece na Central já com a arte e com o produto AWA amarrado, sem precisar de nova mudança.

## Detalhes técnicos

- Upload no bucket público `campaign-images`, pasta `reengajamento`.
- `src/components/central-nutricao/DisparoCustomizadoCard.tsx`: nova entrada em `TEMPLATE_HEADER_IMAGES` para `awa_disparo2`.
- Sem migration, sem alteração de edge function, sem mudança no motor de disparo.
- `src/lib/reengajamentoEmpreendimento.ts` não precisa mudar (regra `awa` já cobre `awa_disparo2`).
