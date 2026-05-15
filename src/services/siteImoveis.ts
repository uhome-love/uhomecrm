/**
 * Legacy service layer for the CRM `properties` table (Typesense-backed).
 * The catalog UI uses `siteImoveisRemote.ts` for the site DB; this file
 * powers the legacy CRM queries that still consume the `properties` table.
 *
 * Canonical types and helpers live in:
 *   - `@/types/imoveis`         (interfaces)
 *   - `@/utils/imoveisFormat`   (formatters, slug, share URL, map pin)
 * Re-exported below as a transition shim so older imports continue to work.
 */

import { supabase } from "@/integrations/supabase/client";
import type { SiteImovel, MapPin, BuscaFilters, BairroCount } from "@/types/imoveis";
import {
  gerarSlugUhome,
  siteImovelToMapPin,
} from "@/utils/imoveisFormat";

/* ── Re-exports (transition shim — do not add new imports against this path) ── */
export type { SiteImovel, MapPin, BuscaFilters, BairroCount } from "@/types/imoveis";
export {
  formatPreco, formatPrecoCompact, fotoPrincipal, shareUrlUhome,
  gerarSlugUhome, siteImovelToMapPin, tituloLimpo,
  CIDADES_PERMITIDAS, PROPERTY_TYPES,
} from "@/utils/imoveisFormat";

const PROPERTY_MAP_SELECT = "id,codigo,tipo,bairro,cidade,valor_venda,valor_locacao,dormitorios,banheiros,vagas,area_privativa,latitude,longitude,titulo,fotos,empreendimento,construtora,situacao";
const PROPERTY_MAP_PAGE_SIZE = 2000;
const PROPERTY_MAP_MAX_ROWS = 30000;

/* ── Helpers (private to this legacy service) ── */

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractCoordinates(doc: Record<string, unknown>): { latitude: number | null; longitude: number | null } {
  const directLat = toFiniteNumber(doc.latitude ?? doc.lat ?? doc.endereco_latitude);
  const directLng = toFiniteNumber(doc.longitude ?? doc.lng ?? doc.lon ?? doc.endereco_longitude);

  if (directLat != null && directLng != null) {
    return { latitude: directLat, longitude: directLng };
  }

  const location = doc.location;

  if (Array.isArray(location) && location.length >= 2) {
    const lat = toFiniteNumber(location[0]);
    const lng = toFiniteNumber(location[1]);
    if (lat != null && lng != null) return { latitude: lat, longitude: lng };
  }

  if (location && typeof location === "object") {
    const loc = location as Record<string, unknown>;
    const lat = toFiniteNumber(loc.lat ?? loc.latitude);
    const lng = toFiniteNumber(loc.lng ?? loc.lon ?? loc.longitude);
    if (lat != null && lng != null) return { latitude: lat, longitude: lng };
  }

  if (typeof location === "string") {
    const [rawLat, rawLng] = location.split(",").map((part) => part.trim());
    const lat = toFiniteNumber(rawLat);
    const lng = toFiniteNumber(rawLng);
    if (lat != null && lng != null) return { latitude: lat, longitude: lng };
  }

  return { latitude: null, longitude: null };
}

/* ── Map Typesense doc → SiteImovel ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDoc(doc: any): SiteImovel {
  const fotos: string[] = doc.fotos?.length ? doc.fotos : doc.foto_principal ? [doc.foto_principal] : [];
  const fotosFull: string[] = doc.fotos_full?.length ? doc.fotos_full : fotos;
  const coords = extractCoordinates(doc);
  const codigo = doc.codigo || doc.id || "";
  // Build slug: prefer DB slug, then generate canonical format
  const slug = doc.slug || gerarSlugUhome({
    tipo: doc.tipo || "imovel",
    quartos: doc.dormitorios != null ? Number(doc.dormitorios) : null,
    bairro: doc.bairro || "",
    codigo,
  });
  return {
    id: doc.id || codigo,
    slug,
    codigo,
    tipo: doc.tipo || "",
    finalidade: doc.finalidade || "venda",
    status: doc.status || "",
    destaque: doc.destaque ?? doc.is_uhome ?? false,
    preco: Number(doc.valor_venda || 0),
    preco_condominio: doc.valor_condominio ? Number(doc.valor_condominio) : null,
    area_total: doc.area_privativa ? Number(doc.area_privativa) : null,
    quartos: doc.dormitorios != null ? Number(doc.dormitorios) : null,
    banheiros: doc.banheiros != null ? Number(doc.banheiros) : null,
    vagas: doc.vagas != null ? Number(doc.vagas) : null,
    suites: doc.suites != null ? Number(doc.suites) : null,
    bairro: doc.bairro || "",
    cidade: doc.cidade || "",
    uf: doc.uf || "RS",
    publicado_em: doc.data_atualizacao || doc.data_cadastro || "",
    foto_principal: fotos[0] || null,
    fotos,
    fotos_full: fotosFull,
    condominio_nome: doc.empreendimento || null,
    empreendimento: doc.empreendimento || null,
    construtora: doc.construtora || null,
    latitude: coords.latitude,
    longitude: coords.longitude,
    titulo: doc.titulo || null,
    endereco: doc.endereco || null,
    _raw: doc,
  };
}

/* ── API calls via PostgREST (properties table) ── */

function applyPropertyFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: BuscaFilters = {},
) {
  let nextQuery = query.eq("ativo", true);

  const cidades = filters.cidades?.length ? filters.cidades : filters.cidade ? [filters.cidade] : [];
  if (cidades.length === 1) nextQuery = nextQuery.eq("cidade", cidades[0]);
  else if (cidades.length > 1) nextQuery = nextQuery.in("cidade", cidades);

  const contrato = filters.contrato || "venda";
  if (contrato === "locacao") nextQuery = nextQuery.gt("valor_locacao", 0);
  else nextQuery = nextQuery.gt("valor_venda", 0);

  if (filters.tipo) {
    const tipos = filters.tipo.split(",").map((s) => s.trim()).filter(Boolean);
    if (tipos.length === 1) nextQuery = nextQuery.eq("tipo", tipos[0]);
    else if (tipos.length > 1) nextQuery = nextQuery.in("tipo", tipos);
  }

  const bairros = filters.bairros?.length
    ? filters.bairros
    : filters.bairro
      ? filters.bairro.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  if (bairros.length === 1) nextQuery = nextQuery.ilike("bairro", `%${bairros[0]}%`);
  else if (bairros.length > 1) nextQuery = nextQuery.or(bairros.map((b) => `bairro.ilike.%${b}%`).join(","));

  if (filters.quartos) nextQuery = nextQuery.gte("dormitorios", filters.quartos);
  if (filters.vagas) nextQuery = nextQuery.gte("vagas", filters.vagas);
  if (filters.banheiros) nextQuery = nextQuery.gte("banheiros", filters.banheiros);

  const priceField = contrato === "locacao" ? "valor_locacao" : "valor_venda";
  if (filters.precoMin) nextQuery = nextQuery.gte(priceField, filters.precoMin);
  if (filters.precoMax) nextQuery = nextQuery.lte(priceField, filters.precoMax);

  if (filters.areaMin) nextQuery = nextQuery.gte("area_privativa", filters.areaMin);
  if (filters.areaMax) nextQuery = nextQuery.lte("area_privativa", filters.areaMax);

  if (filters.construtora?.length) nextQuery = nextQuery.in("construtora", filters.construtora);
  if (filters.empreendimento?.length) nextQuery = nextQuery.in("empreendimento", filters.empreendimento);
  if (filters.situacao?.length) nextQuery = nextQuery.in("situacao", filters.situacao);

  // New indexed filters
  if (filters.statusImovelList?.length) {
    if (filters.statusImovelList.length === 1) nextQuery = nextQuery.eq("status_imovel", filters.statusImovelList[0]);
    else nextQuery = nextQuery.in("status_imovel", filters.statusImovelList);
  } else if (filters.statusImovel) {
    nextQuery = nextQuery.eq("status_imovel", filters.statusImovel);
  }
  if (filters.condominioNome) {
    nextQuery = nextQuery.or(`condominio_nome.ilike.%${filters.condominioNome}%,empreendimento.ilike.%${filters.condominioNome}%,codigo.ilike.%${filters.condominioNome}%`);
  }
  if (filters.financiavel) nextQuery = nextQuery.eq("financiavel", true);
  if (filters.mobiliado) nextQuery = nextQuery.eq("mobiliado", true);
  if (filters.comodidades?.length) {
    for (const c of filters.comodidades) {
      nextQuery = nextQuery.contains("comodidades", [c]);
    }
  }
  if (filters.entregaAnoMin) nextQuery = nextQuery.gte("entrega_ano", filters.entregaAnoMin);
  if (filters.entregaAnoMax) nextQuery = nextQuery.lte("entrega_ano", filters.entregaAnoMax);

  if (filters.bounds) {
    nextQuery = nextQuery
      .gte("latitude", filters.bounds.lat_min)
      .lte("latitude", filters.bounds.lat_max)
      .gte("longitude", filters.bounds.lng_min)
      .lte("longitude", filters.bounds.lng_max);
  }

  if (filters.q) {
    nextQuery = nextQuery.or(`titulo.ilike.%${filters.q}%,bairro.ilike.%${filters.q}%,codigo.ilike.%${filters.q}%,empreendimento.ilike.%${filters.q}%`);
  }

  if (filters.codigo) {
    nextQuery = nextQuery.ilike("codigo", `%${filters.codigo}%`);
  }

  return { query: nextQuery, contrato, priceField };
}

async function fetchAllPropertyRows(filters: BuscaFilters = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = [];

  for (let offset = 0; offset < PROPERTY_MAP_MAX_ROWS; offset += PROPERTY_MAP_PAGE_SIZE) {
    const query = supabase.from("properties").select(PROPERTY_MAP_SELECT);
    const { query: filteredQuery } = applyPropertyFilters(query, filters);
    const { data, error } = await filteredQuery.range(offset, offset + PROPERTY_MAP_PAGE_SIZE - 1);

    if (error) throw new Error(error.message || "Search failed");
    if (!data?.length) break;

    rows.push(...data);
    if (data.length < PROPERTY_MAP_PAGE_SIZE) break;
  }

  return rows;
}

export async function fetchSiteImoveis(filters: BuscaFilters = {}): Promise<{ data: SiteImovel[]; count: number; search_time_ms?: number }> {
  const limit = filters.limit || 24;
  const offset = filters.offset || 0;
  const startTime = Date.now();

  let query = supabase
    .from("properties")
    .select("*", { count: "exact" })
  const { query: filteredQuery, priceField } = applyPropertyFilters(query, filters);
  query = filteredQuery;

  // Sort
  switch (filters.ordem) {
    case "preco_asc": query = query.order(priceField, { ascending: true, nullsFirst: false }); break;
    case "preco_desc": query = query.order(priceField, { ascending: false, nullsFirst: false }); break;
    case "area_desc": query = query.order("area_privativa", { ascending: false, nullsFirst: false }); break;
    default: query = query.order("updated_at", { ascending: false }); break;
  }

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  // 416 = Range Not Satisfiable (offset beyond total rows) — return empty gracefully
  if (error) {
    if (error.code === "PGRST103" || error.message?.includes("Requested range not satisfiable")) {
      // Preserve the requested offset as a hint that we've reached the end
      // Return offset as count so hasMore = (items.length >= offset) stays false
      return { data: [], count: offset, search_time_ms: Date.now() - startTime };
    }
    throw new Error(error.message || "Search failed");
  }

  const docs = (data || []).map(mapDoc);
  return {
    data: docs,
    count: count ?? 0,
    search_time_ms: Date.now() - startTime,
  };
}

/**
 * Fetch map pins — uses real lat/lng from Typesense.
 * Falls back to bairro centroids with jitter when coordinates are missing.
 * When bounds are active, scans multiple pages so the current viewport
 * does not end up empty just because the first search page has no matches.
 */
export async function fetchMapPins(filters: BuscaFilters = {}): Promise<MapPin[]> {
  const rows = await fetchAllPropertyRows(filters);
  if (!rows.length) return [];

  const pins: MapPin[] = [];
  const bounds = filters.bounds;
  for (const doc of rows) {
    const mapped = mapDoc(doc);
    const pin = siteImovelToMapPin(mapped, bounds);
    if (pin) pins.push(pin);
  }
  return pins;
}

export async function fetchBairros(): Promise<BairroCount[]> {
  const { data, error } = await supabase.rpc("get_bairros_disponiveis");
  if (error || !data?.length) return [];
  return (data as { bairro: string; count: number }[])
    .filter(b => b.bairro?.trim())
    .map(b => ({ bairro: b.bairro, count: Number(b.count) || 0 }))
    .sort((a, b) => a.bairro.localeCompare(b.bairro, "pt-BR"));
}

export async function fetchImovelBySlug(slug: string): Promise<SiteImovel | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("ativo", true)
    .eq("codigo", slug)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapDoc(data);
}
