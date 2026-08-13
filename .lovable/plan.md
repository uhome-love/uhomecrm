# Padronização de canal de origem — view `v_lead_canal` (aditiva, read-only)

Objetivo: uma única fonte de verdade para "canal" dos leads, sem tocar em nenhuma tabela ou dado. Só uma view de leitura.

## O que vai existir

`public.v_lead_canal` — uma linha por lead, com:

- `lead_id`, `origem` (valor original, intacto), `canal` (canônico)
- extras para cruzamento: `campanha`, `created_at`, `stage_id`, `corretor_id`

Nada é alterado em `pipeline_leads`: sem coluna nova, sem UPDATE, sem trigger.

## Regra do canal (na ordem exata pedida)

1. TikTok — origem contém `tik`
2. Meta — lista fixa de rótulos + regex `meta|facebook|instagram`
3. Portal — `imovelweb|olx|viva real|zap|portal|grupo olx`
4. Site próprio — `site|landing|uhome.com|quiz`
5. CRM / Nutrição — `brevo|sms|nutri|reengaj|oferta ativa|oferta_ativa`
6. Manual / Indicação — `indica|network|manual|formul|liga`
7. senão — `Não classificado`

## Conferência prévia nos dados atuais

Rótulos distintos hoje: 52. Aplicando a regra, o que cai em **Não classificado** é só: `outro` (85), `não informado` (77), `an` (5), `RGI` (3), `Chaozão` (3), `venda` (2), `NULL` (13) — ~188 leads (~2%). Todo o resto de volume alto (`meta_ads` 3.501, `Facebook Leads Ads` 1.491, `ig` 1.053, `meta_backfill` 854, `fb` 327 → Meta; `Oferta Ativa` 684 e `Reengajamento` 341 → CRM/Nutrição; `imovelweb` 329 → Portal) é classificado.

Observação de ordem: "Leads Gerado do Tik Tok: Vídeo Open Gabrielle" cai em TikTok (regra 1 vem antes), como pedido.

## SQL da migration (apenas DDL de view)

```sql
CREATE OR REPLACE VIEW public.v_lead_canal AS
SELECT
  pl.id            AS lead_id,
  pl.origem        AS origem,
  pl.campanha      AS campanha,
  pl.created_at    AS created_at,
  pl.stage_id      AS stage_id,
  pl.corretor_id   AS corretor_id,
  CASE
    WHEN lower(coalesce(pl.origem, '')) LIKE '%tik%' THEN 'TikTok'
    WHEN pl.origem IN (
      'meta_ads','meta_backfill','ig','fb','FacebookAds','Meta Ads',
      'Facebook Leads Ads','instagram','campanha_atrio',
      'Open Bosque (Video Lucas)','Vértice - Bairro Las Casas (Imagem)',
      'Casa Tua','Orygem (Vídeo Lucas)','Casa Bastian (Imagem)',
      'Lake Eyre (1 Video - Lucas - Vista)','Shift (Video Gabriel)',
      'Operação Especial Casa Tua'
    ) THEN 'Meta'
    WHEN lower(coalesce(pl.origem, '')) ~ 'meta|facebook|instagram' THEN 'Meta'
    WHEN lower(coalesce(pl.origem, '')) ~ 'imovelweb|olx|viva real|zap|portal|grupo olx' THEN 'Portal'
    WHEN lower(coalesce(pl.origem, '')) ~ 'site|landing|uhome\.com|quiz' THEN 'Site próprio'
    WHEN lower(coalesce(pl.origem, '')) ~ 'brevo|sms|nutri|reengaj|oferta ativa|oferta_ativa' THEN 'CRM / Nutrição'
    WHEN lower(coalesce(pl.origem, '')) ~ 'indica|network|manual|formul|liga' THEN 'Manual / Indicação'
    ELSE 'Não classificado'
  END AS canal
FROM public.pipeline_leads pl;

ALTER VIEW public.v_lead_canal SET (security_invoker = on);

GRANT SELECT ON public.v_lead_canal TO authenticated;
GRANT ALL   ON public.v_lead_canal TO service_role;
```

`security_invoker = on` garante que a view respeita exatamente as RLS de `pipeline_leads` de quem consulta — nenhum corretor passa a ver lead que já não veria.

## Validação após aplicar (só leitura)

- `SELECT canal, count(*) FROM public.v_lead_canal GROUP BY 1 ORDER BY 2 DESC;` — conferir que bate com a projeção acima.
- `SELECT origem, count(*) FROM public.v_lead_canal WHERE canal = 'Não classificado' GROUP BY 1;` — revisar a cauda e decidir depois se algum rótulo (ex.: `an`, `RGI`) merece regra própria.

## Fora de escopo

Nenhuma mudança de frontend, nenhum dashboard passa a usar a view neste passo. Se quiser, num passo seguinte plugo a view no Central de Marketing / Performance.
