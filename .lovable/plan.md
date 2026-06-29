# Incluir a "message" do Meta Ads no histórico do lead (rótulo "Anúncio")

## Problema
No formulário do Meta Ads você usa o campo **message** para identificar o criativo/anúncio que originou o lead (ex.: `video gabriel tour 2D no casa tua`). Hoje a função `receive-meta-lead` captura esse `message`, mas **não** o coloca na atividade de "entrada" do histórico, então a identificação do criativo se perde.

## Solução
Mostrar a mensagem do formulário como um detalhe **"Anúncio: …"** na atividade de entrada do lead, sempre que ela existir e não for um texto genérico de placeholder.

### Comportamento final
- `message` específico → aparece no subtítulo como `Anúncio: video gabriel tour 2D no casa tua`
- `message` genérico/vazio (`Lead Gerado do Formulário`, etc.) → não aparece
- A dedup existente evita repetir se já constar campanha/empreendimento.

## Detalhes técnicos
Arquivo único alterado: `supabase/functions/receive-meta-lead/index.ts` (atividade de entrada, ~linhas 908-923).

1. Lista de placeholders genéricos a ignorar:
```ts
const GENERIC_FORM_MESSAGES = [
  "lead gerado do formulário", "lead gerado do formulario",
  "lead gerado do anúncio", "lead gerado do anuncio", "lead gerado",
];
const isGenericMessage = (m: string) =>
  GENERIC_FORM_MESSAGES.includes(normalizeTimelineText(m));
```

2. Usar a mensagem como valor do "Anúncio" (com prioridade sobre o `adName` técnico quando a mensagem for específica):
```ts
addTimelineDetail(entradaParts, "Campanha", campaignName, [entryPrimary, formName]);
addTimelineDetail(entradaParts, "Cód. imóvel", propertyCode, [entryPrimary]);

const anuncioValue = (message && !isGenericMessage(message)) ? message : adName;
addTimelineDetail(entradaParts, "Anúncio", anuncioValue, [entryPrimary, campaignName, formName]);
```

3. Deploy da edge function `receive-meta-lead`.

## Fora de escopo
- Não altera tabelas, RLS, roleta, segmentos nem outras edge functions.
- Não muda a captura do `message` (já funciona) — só a exibição no histórico.
