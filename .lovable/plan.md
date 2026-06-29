## Objetivo
Corrigir o texto de entrada do lead no histórico para ficar limpo, sem duplicação e com origem amigável para o corretor.

## Padrão final
O título deve concentrar a informação principal:

```text
Lead gerado via Meta Ads — Átrio
```

O subtítulo só deve aparecer se houver uma informação adicional que não esteja no título. Portanto, neste caso não deve mostrar:

```text
Meta Ads · Átrio
```

porque isso duplica exatamente o título.

## Regras de exibição

### Meta Ads
- Qualquer origem técnica como `meta_backfill`, `meta_native`, `facebook`, `instagram` ou similar deve aparecer como `Meta Ads`.
- Título:

```text
Lead gerado via Meta Ads — Nome da campanha/empreendimento
```

- Subtítulo:
  - Não repetir `Meta Ads`.
  - Não repetir o empreendimento/campanha já usado no título.
  - Só mostrar algo se for realmente extra e útil, por exemplo um código de campanha diferente ou um detalhe que não aparece no título.
  - Se não houver extra real, deixar sem subtítulo.

### Imóvel Web
- Título:

```text
Lead gerado via Imóvel Web — Imóvel 12345
```

ou, se não houver código:

```text
Lead gerado via Imóvel Web — Nome do empreendimento
```

- Subtítulo só com informação extra não repetida, como mensagem do lead ou outro dado útil.

### TikTok, RD Station e Landing Page
- Usar o mesmo padrão:

```text
Lead gerado via TikTok Ads — Campanha/empreendimento
Lead gerado via RD Station — Campanha/empreendimento
Lead gerado via Landing Page — Empreendimento
```

- Subtítulo apenas se houver informação adicional não repetida.

## Arquivos a ajustar

### `supabase/functions/receive-meta-lead/index.ts`
- Normalizar origem técnica para label amigável.
- Montar título com origem + campanha/empreendimento.
- Trocar a montagem atual de `descricao` para uma versão deduplicada.
- Remover do subtítulo informações já presentes no título.

### `supabase/functions/receive-imovelweb-lead/index.ts`
- Aplicar o mesmo padrão anti-duplicação para Imóvel Web.

### `supabase/functions/receive-tiktok-lead/index.ts`
- Aplicar o mesmo padrão anti-duplicação para TikTok Ads.

### `supabase/functions/receive-rdstation-lead/index.ts`
- Aplicar o mesmo padrão anti-duplicação para RD Station.

### `supabase/functions/receive-landing-lead/index.ts`
- Aplicar o mesmo padrão anti-duplicação para Landing Page.

## Fora de escopo
- Não alterar banco, RLS, tabelas, Storage ou frontend.
- Não mexer no layout do histórico.
- A correção vale para novos cadastros daqui para frente. Registros antigos só seriam ajustados se você pedir depois.

## Validação
- Confirmar que `meta_backfill` nunca aparece no histórico.
- Confirmar que o exemplo final fica sem subtítulo duplicado:

```text
Lead gerado via Meta Ads — Átrio
```

- Confirmar que outras origens seguem o mesmo padrão limpo.