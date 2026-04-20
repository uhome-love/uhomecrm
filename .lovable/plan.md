

# Fase 1 — Execução: extração de tipos e helpers canônicos

Refactor 100% mecânico. Zero mudança de UI, lógica, query, rota ou copy.

## Arquivos novos

**`src/types/imoveis.ts`** — apenas tipos, copiados caractere por caractere de `siteImoveis.ts`:
- `SiteImovel`, `MapPin`, `BuscaFilters`, `BairroCount`

**`src/utils/imoveisFormat.ts`** — helpers + constantes, copiados caractere por caractere:
- Públicos: `formatPreco`, `formatPrecoCompact`, `fotoPrincipal`, `shareUrlUhome`, `gerarSlugUhome`, `siteImovelToMapPin`, `tituloLimpo`
- Privados: `slugify`, `normalizeTipoSlug`, `capitalize`, `jitter`, `BAIRRO_CENTROIDS`
- Constantes: `CIDADES_PERMITIDAS`, `PROPERTY_TYPES`
- Importa tipos via `import type { SiteImovel, MapPin } from "@/types/imoveis"`

## Imports atualizados (8 arquivos)

| Arquivo | Linha | Novo import |
|---|---|---|
| `src/pages/ImoveisPage.tsx` | 35-37 | `type { SiteImovel, MapPin, BuscaFilters }` de `@/types/imoveis` + `{ siteImovelToMapPin, formatPreco, CIDADES_PERMITIDAS, PROPERTY_TYPES }` de `@/utils/imoveisFormat` |
| `src/pages/ImovelPage.tsx` | 19 | `{ gerarSlugUhome }` de `@/utils/imoveisFormat` |
| `src/services/siteImoveisRemote.ts` | 17-18 | `type { SiteImovel, MapPin, BairroCount, BuscaFilters }` de `@/types/imoveis` + `{ siteImovelToMapPin }` de `@/utils/imoveisFormat` |
| `src/components/imoveis/SitePropertyCard.tsx` | 9 | `type { SiteImovel }` de `@/types/imoveis` + `{ fotoPrincipal, formatPreco, shareUrlUhome }` de `@/utils/imoveisFormat` |
| `src/components/imoveis/SearchMapBox.tsx` | 11 | `type { MapPin }` de `@/types/imoveis` + `{ formatPrecoCompact, formatPreco }` de `@/utils/imoveisFormat` |
| `src/components/imoveis/PropertyPreviewDrawer.tsx` | 29 | `{ gerarSlugUhome }` de `@/utils/imoveisFormat` |
| `src/components/imoveis/SharePropertyButton.tsx` | 16 | `{ gerarSlugUhome }` de `@/utils/imoveisFormat` |
| `src/components/pipeline/radar/RadarFullscreenModal.tsx` | 16 | `{ gerarSlugUhome }` de `@/utils/imoveisFormat` |

## `src/services/siteImoveis.ts` — vira shim + busca legada

**Mantém intacto:** `fetchSiteImoveis`, `fetchMapPins`, `fetchBairros`, `fetchImovelBySlug`, e privados `applyPropertyFilters`, `fetchAllPropertyRows`, `mapDoc`, `extractCoordinates`, `toFiniteNumber`, constantes `PROPERTY_MAP_SELECT`, `PROPERTY_MAP_PAGE_SIZE`, `PROPERTY_MAP_MAX_ROWS`, e o import do supabase client.

**Remove:** definições originais dos tipos, helpers públicos (`formatPreco`, `formatPrecoCompact`, `fotoPrincipal`, `shareUrlUhome`, `gerarSlugUhome`, `siteImovelToMapPin`, `tituloLimpo`), helpers privados (`slugify`, `normalizeTipoSlug`, `capitalize`, `jitter`, `BAIRRO_CENTROIDS`) e constantes públicas (`CIDADES_PERMITIDAS`, `PROPERTY_TYPES`).

**Adiciona no topo (após imports), como rede de segurança:**
```ts
export type { SiteImovel, MapPin, BuscaFilters, BairroCount } from "@/types/imoveis";
export {
  formatPreco, formatPrecoCompact, fotoPrincipal, shareUrlUhome,
  gerarSlugUhome, siteImovelToMapPin, tituloLimpo,
  CIDADES_PERMITIDAS, PROPERTY_TYPES,
} from "@/utils/imoveisFormat";
```

A própria função `fetchSiteImoveis` e companhia continuam usando os símbolos via os re-exports (sem refatorar nada interno).

## Verificação pós-execução (vou reportar)

- (a) **TypeScript**: `tsc --noEmit` → zero erros
- (b) **Grep `from.*@/services/siteImoveis`** em `src/` → lista os imports restantes; confirmação de que nenhum dos 8 consumidores aparece (apenas potenciais consumidores legítimos do bloco de busca, se houver)
- (c) **Diff summary** por arquivo (linhas +/–)
- (d) **Confirmação explícita** de que apenas 11 arquivos foram tocados:
  1. `src/types/imoveis.ts` (criado)
  2. `src/utils/imoveisFormat.ts` (criado)
  3. `src/services/siteImoveis.ts` (modificado)
  4-11. Os 8 consumidores

## Guardrails reafirmados

Nenhum hook, query Supabase, token de cor, classe Tailwind, JSX, store, rota, sidebar, label, texto visível ao usuário, ou função do bloco de busca legado será modificado. `siteImoveisRemote.ts` recebe **apenas** atualização de imports — lógica intocada.

