# Estágio 1 — padronização de dados (só leitura + 1 view aditiva)

## A) Resposta da pergunta crítica de risco

**A premissa está incorreta e o UPDATE proposto é PERIGOSO. Recomendo NÃO executá-lo.** Três fatos verificados no banco de produção agora:

1. **`empreendimentos_canonicos.segmento_id` NÃO está vazio.** Os 70 registros estão 100% preenchidos (`count(*) = 70`, `count(segmento_id) = 70`).

2. **Ele não aponta para `pipeline_segmentos`.** A FK é `empreendimentos_canonicos_segmento_id_fkey → roleta_segmentos(id)`. Existem DUAS tabelas de segmento com nomes idênticos e UUIDs diferentes:

| Nome | `roleta_segmentos` (usado aqui) | `pipeline_segmentos` |
|---|---|---|
| S1 - Moradia | 9948f523-…dd50 | c8b24415-…cb7a |
| S2 - Investimento | 409aeddf-…35e | dd96ad01-…b26 |
| S3 - Alto Padrão | 5311aaaa-…0005 | 5e930c09-…e74 |
| S4 - MCMV | 93ca556c-…47f0 | 5311bbbb-…0003 |

Gravar os IDs de `pipeline_segmentos` nessa coluna violaria a FK (ou, se passasse, quebraria toda a roleta com segmentos inexistentes).

3. **O campo É LIDO por lógica de distribuição — não é descritivo.** Usos confirmados:
   - `public.credenciar_por_alocacao(p_janela)` — deriva `segmento_1_id`/`segmento_2_id` do credenciamento a partir de `ec.segmento_id` dos empreendimentos alocados ao corretor. Mudar o tier muda em qual segmento o corretor se credencia na roleta.
   - `public.distribuir_lead_atomico` e `public.oferta_ativa_lock_next_lead` também referenciam segmento nesse caminho.
   - Edge function `oferta-ativa-popular-fila` grava `segmento_id` na fila a partir de `empreendimentos_canonicos`.
   - Além disso, a coluna é NOT NULL — "deixar NULL para Avulso e Melnick Day" não é possível sem alterar a estrutura.

### Divergência real entre o mapa pedido e o que está no banco

Comparando o mapa com os dados atuais, quase tudo já bate. Só há **2 diferenças** (fora dos 2 que você queria zerar):

| Empreendimento | Hoje | Seu mapa |
|---|---|---|
| Grand Park Moinhos | S1 - Moradia | S3 - Alto Padrão |
| Casa Menino Deus | S2 - Investimento | S3 - Alto Padrão |
| Avulso | S1 - Moradia | NULL (não é possível: NOT NULL + roleta) |
| Melnick Day | S1 - Moradia | NULL (idem) |

Ambos os divergentes estão hoje com `ativo = false`, então o impacto operacional de corrigi-los seria pequeno — mas continua sendo uma mudança de comportamento de roleta, não de marketing.

### Caminho seguro proposto

**Não tocar em `empreendimentos_canonicos.segmento_id` neste estágio.** Em vez disso, criar uma classificação de marketing separada, aditiva e sem efeito operacional:

- Nova tabela de-para `public.empreendimento_tier_marketing` (`empreendimento_id` PK → `empreendimentos_canonicos`, `tier` texto S1..S4, `observacao`), populada com o seu mapa (incluindo Grand Park Moinhos e Casa Menino Deus como S3, e Avulso/Melnick Day simplesmente ausentes = sem tier).
- Nada na roleta lê essa tabela. Análises e dashboards passam a usá-la.

Se depois de ver isso você quiser mesmo **corrigir a roleta** para Grand Park Moinhos e Casa Menino Deus, faço num passo separado, explícito, com backup — mas aí é decisão operacional, não padronização de dados.

## B) View de canal — `public.v_lead_canal`

Aditiva, read-only, `security_invoker = on`. Nenhuma coluna nova em `pipeline_leads`, nenhum dado alterado.

Regra na ordem: TikTok → Meta → Portal → Site próprio → CRM/Nutrição → Manual/Indicação → Não classificado.

Conferência prévia: 52 rótulos distintos hoje; cai em "Não classificado" só `outro` (85), `não informado` (77), `an` (5), `RGI` (3), `Chaozão` (3), `venda` (2) e NULL (13) ≈ 2% da base.

## Migration proposta (só DDL — nenhum UPDATE em dado existente)

```sql
-- 1) De-para de tier de MARKETING (não interfere em roleta/distribuição)
CREATE TABLE IF NOT EXISTS public.empreendimento_tier_marketing (
  empreendimento_id uuid PRIMARY KEY REFERENCES public.empreendimentos_canonicos(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('S1 - Moradia','S2 - Investimento','S3 - Alto Padrão','S4 - MCMV')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.empreendimento_tier_marketing TO authenticated;
GRANT ALL    ON public.empreendimento_tier_marketing TO service_role;

ALTER TABLE public.empreendimento_tier_marketing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem tier de marketing"
  ON public.empreendimento_tier_marketing FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin gerencia tier de marketing"
  ON public.empreendimento_tier_marketing FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_tier_marketing_updated_at
  BEFORE UPDATE ON public.empreendimento_tier_marketing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) View de canal canônico do lead
CREATE OR REPLACE VIEW public.v_lead_canal AS
SELECT
  pl.id          AS lead_id,
  pl.origem,
  pl.campanha,
  pl.created_at,
  pl.stage_id,
  pl.corretor_id,
  CASE
    WHEN lower(coalesce(pl.origem,'')) LIKE '%tik%' THEN 'TikTok'
    WHEN pl.origem IN (
      'meta_ads','meta_backfill','ig','fb','FacebookAds','Meta Ads',
      'Facebook Leads Ads','instagram','campanha_atrio',
      'Open Bosque (Video Lucas)','Vértice - Bairro Las Casas (Imagem)',
      'Casa Tua','Orygem (Vídeo Lucas)','Casa Bastian (Imagem)',
      'Lake Eyre (1 Video - Lucas - Vista)','Shift (Video Gabriel)',
      'Operação Especial Casa Tua'
    ) THEN 'Meta'
    WHEN lower(coalesce(pl.origem,'')) ~ 'meta|facebook|instagram' THEN 'Meta'
    WHEN lower(coalesce(pl.origem,'')) ~ 'imovelweb|olx|viva real|zap|portal|grupo olx' THEN 'Portal'
    WHEN lower(coalesce(pl.origem,'')) ~ 'site|landing|uhome\.com|quiz' THEN 'Site próprio'
    WHEN lower(coalesce(pl.origem,'')) ~ 'brevo|sms|nutri|reengaj|oferta ativa|oferta_ativa' THEN 'CRM / Nutrição'
    WHEN lower(coalesce(pl.origem,'')) ~ 'indica|network|manual|formul|liga' THEN 'Manual / Indicação'
    ELSE 'Não classificado'
  END AS canal
FROM public.pipeline_leads pl;

ALTER VIEW public.v_lead_canal SET (security_invoker = on);

GRANT SELECT ON public.v_lead_canal TO authenticated;
GRANT ALL    ON public.v_lead_canal TO service_role;
```

A carga das ~24 linhas do de-para (seu mapa) entra em seguida como **operação de dados**, separada da migration, e não toca em nenhuma linha existente.

## Queries de validação (só leitura, após aplicar)

```sql
-- canal
SELECT canal, count(*) FROM public.v_lead_canal GROUP BY 1 ORDER BY 2 DESC;
SELECT origem, count(*) FROM public.v_lead_canal
 WHERE canal = 'Não classificado' GROUP BY 1 ORDER BY 2 DESC;

-- tier de marketing x segmento operacional (mostra onde divergem, sem alterar nada)
SELECT ec.nome, rs.nome AS segmento_roleta, t.tier AS tier_marketing, ec.ativo
FROM public.empreendimentos_canonicos ec
LEFT JOIN public.roleta_segmentos rs ON rs.id = ec.segmento_id
LEFT JOIN public.empreendimento_tier_marketing t ON t.empreendimento_id = ec.id
ORDER BY (t.tier IS DISTINCT FROM rs.nome) DESC, ec.nome;

-- prova de que nada da roleta mudou
SELECT count(*) FROM public.empreendimentos_canonicos WHERE segmento_id IS NULL; -- deve ser 0
```

## Decisão que preciso de você

1. Confirmar o caminho da tabela de tier de marketing (em vez do UPDATE em `segmento_id`).
2. Dizer se quer, num passo separado, corrigir na roleta os 2 divergentes (Grand Park Moinhos e Casa Menino Deus → S3). Ambos estão inativos hoje.
