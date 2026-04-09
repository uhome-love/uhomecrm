

# Plano: Correcoes Criticas Vitrines + Radar

## Prioridade 1 — Fix vitrine no banco errado

**Arquivo:** `src/pages/ImoveisPageNew.tsx` linha 464

**Mudanca:** Trocar `supabaseSite` por `supabase` na chamada de insert da vitrine. O import de `supabaseSite` continua necessario para as queries de busca de imoveis.

```
// Linha 464: supabaseSite.from("vitrines") → supabase.from("vitrines")
```

Uma unica linha. As queries de busca (imoveis, bairros, mapa) continuam usando `supabaseSite`.

---

## Prioridade 2A — Fallback Supabase do Radar

**Arquivo:** `src/components/pipeline/RadarImoveisTab.tsx` linhas 827-887

**Mudanca:** Na funcao `searchSupabaseFallback`:
- Importar `supabaseSite` de `@/lib/supabaseSite`
- Trocar `supabase.from("properties")` por `supabaseSite.from("imoveis")`
- Remapear campos:
  - `valor_venda` → `preco`
  - `dormitorios` → `quartos`
  - `area_privativa` → `area_total`
  - `codigo` → `jetimob_id`
  - `ativo = true` → `status = 'disponivel'`
  - `fotos` (array de objetos `{url}`) → extrair `.url`
  - Adicionar `condominio_nome` ao select
- Manter a mesma interface de retorno `ImovelResult[]`

## Prioridade 2B — Autocomplete de bairros do Radar

**Arquivo:** `src/components/pipeline/RadarImoveisTab.tsx` linhas 527-532

**Mudanca:** Trocar `supabase.from("properties").select("bairro").ilike(...).eq("ativo", true)` por `supabaseSite.from("imoveis").select("bairro").ilike(...).eq("status", "disponivel")`

---

## Prioridade 3 — Fallback na Edge Function vitrine-public

**Arquivo:** `supabase/functions/vitrine-public/index.ts` linhas 218-249

**Mudanca:** Apos a busca em `properties` (CRM), para os codigos NAO encontrados, buscar na tabela `imoveis` do site.

Implementacao:
1. Criar um segundo client Supabase apontando para o projeto do site:
```typescript
const SITE_URL = "https://huigglwvvzuwwyqvpmec.supabase.co";
const SITE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1aWdnbHd2dnp1d3d5cXZwbWVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTMzNzcsImV4cCI6MjA4OTYyOTM3N30.mi8RveT9gYhxP-sfq0GIN1jog-vU3Sxq511LCq5hhw4";
const supabaseSite = createClient(SITE_URL, SITE_ANON);
```

2. Apos identificar `missingIds` (codigos nao encontrados em `properties`), buscar:
```typescript
const { data: siteProps } = await supabaseSite
  .from("imoveis")
  .select("id,slug,jetimob_id,tipo,preco,area_total,quartos,banheiros,vagas,bairro,cidade,titulo,fotos,foto_principal,condominio_nome,latitude,longitude")
  .in("jetimob_id", missingIds)
  .eq("status", "disponivel");
```

3. Mapear os resultados do site para o mesmo formato (similar ao `mapPropertyRow` mas com campos do site), e mergear no `allMap`.

4. O fallback Jetimob continua como ultima opcao para codigos nao encontrados em nenhuma das duas tabelas.

---

## Arquivos modificados

| Arquivo | Mudanca | Impacto |
|---------|---------|---------|
| `src/pages/ImoveisPageNew.tsx` | Linha 464: `supabaseSite` → `supabase` | Critico |
| `src/components/pipeline/RadarImoveisTab.tsx` | Import `supabaseSite`, fallback + bairros | Alto |
| `supabase/functions/vitrine-public/index.ts` | Client site + fallback na busca de imoveis | Alto |

## NAO alterar
- `siteImoveisRemote.ts`, `siteImoveis.ts`
- Typesense, scoring, sidebar, rotas, tema

## Ordem de execucao
Fix 1 (1 linha) → Fix 2A+2B (Radar) → Fix 3 (Edge Function) → Deploy e testar

