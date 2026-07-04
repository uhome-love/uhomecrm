# Lake Baikal (Meta) → Segmento Alto Padrão 100%

## Objetivo
Todo lead que entrar pelo anúncio do Meta com o formulário **"Uhome - Lake Baycal"** deve:
1. Ser reconhecido como empreendimento **Lake Baikal**
2. Cair no segmento **S4 - Alto Padrão**

## O que já está correto (não mexer)
- `roleta_campanhas` já tem a linha **Lake Baikal → S4 - Alto Padrão**.
- A cadeia de resolução `roleta_campanhas → roleta_segmentos → pipeline_segmentos` funciona quando o empreendimento resolvido é exatamente "Lake Baikal".
- `src/lib/empreendimentos.ts` já lista "Lake Baikal".

## O problema
O Meta envia `form_name = "Uhome - Lake Baycal"`. Hoje:
- Não existe entrada no `META_FORM_ID_MAP` para esse nome.
- A normalização remove apenas o sufixo `" - Uhome"`, não o prefixo `"Uhome - "`, nem corrige a grafia "Baycal".
- Resultado: empreendimento fica `"Uhome - Lake Baycal"`, o `ilike('%Uhome - Lake Baycal%')` não bate com a linha "Lake Baikal" da roleta, e o lead entra **sem segmento**.

## Alterações

### 1. Mapa de formulário (edge + front)
Adicionar o nome do formulário mapeado para o empreendimento canônico, nos dois lugares que precisam ficar sincronizados:
- `supabase/functions/receive-meta-lead/index.ts` (const `META_FORM_ID_MAP` interno)
- `src/lib/metaFormIdMap.ts` (`META_FORM_ID_MAP`)

Entradas (cobrindo variações de grafia):
```
"Uhome - Lake Baycal": "Lake Baikal",
"Uhome - Lake Baikal": "Lake Baikal",
"Uhome - Lake Baical": "Lake Baikal",
```

### 2. Canonicalização robusta por nome (rede de segurança)
No `receive-meta-lead/index.ts`, logo após a etapa de normalização do `empreendimento` (onde hoje removem sufixos), adicionar uma regra que detecta qualquer variante de Baikal e força o nome canônico:

```
// Canonicaliza variações de "Lake Baikal" (Baikal/Baical/Baycal, com/sem prefixo Uhome)
if (/\bl(a|á)ke?\s*ba[iy]?ca?l\b/i.test(empreendimento) || /\bba[iy]ca?l\b/i.test(empreendimento)) {
  empreendimento = "Lake Baikal";
}
```
(O regex final será ajustado/validado para casar "Lake Baycal", "Lake Baical", "Lake Baikal", "Baikal", "Baical" e não gerar falso-positivo em outros empreendimentos.)

Isso garante que, mesmo se o Meta mudar levemente o texto (prefixo, maiúsculas, grafia), o empreendimento vira "Lake Baikal", que já resolve para S4 - Alto Padrão.

## Validação
1. `tsgo` / build limpo.
2. Teste do edge function via chamada direta simulando o payload do Meta com `form_name = "Uhome - Lake Baycal"` (e uma variação "Uhome - Lake Baical"), com telefone de teste, verificando na resposta/no banco que o lead foi criado com `empreendimento = "Lake Baikal"` e `segmento_id` = id de "S4 - Alto Padrão" (`5e930c09-634d-40e1-9ccc-981b0a4eae74`).
3. Conferir no log que a resolução de segmento não caiu em "Avulso - Meta Ads".

## Fora de escopo
- Nenhuma mudança de schema ou de UI.
- Não altero a lógica da roleta nem os segmentos existentes.
