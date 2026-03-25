/**
 * Service layer for fetching properties via Typesense search.
 * Powers the /imoveis page with the same data as uhome.com.br.
 */

import { supabase } from "@/integrations/supabase/client";

/* ── Types ── */

export interface SiteImovel {
  id: string;
  slug: string;
  codigo: string;
  tipo: string;
  finalidade: string;
  status: string;
  destaque: boolean;
  preco: number;
  preco_condominio: number | null;
  area_total: number | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  suites: number | null;
  bairro: string;
  cidade: string;
  uf: string;
  publicado_em: string;
  foto_principal: string | null;
  fotos: string[];
  fotos_full: string[];
  condominio_nome: string | null;
  empreendimento: string | null;
  construtora: string | null;
  latitude: number | null;
  longitude: number | null;
  titulo: string | null;
  endereco: string | null;
  _raw?: Record<string, unknown>;
}

export interface MapPin {
  id: string;
  slug: string;
  preco: number;
  latitude: number;
  longitude: number;
  bairro: string;
  titulo: string;
  tipo: string;
  quartos: number | null;
  area_total: number | null;
  foto_principal?: string;
}

export interface BairroCount {
  bairro: string;
  count: number;
}

export interface BuscaFilters {
  tipo?: string;
  bairro?: string;
  bairros?: string[];
  cidade?: string;
  cidades?: string[];
  precoMin?: number;
  precoMax?: number;
  areaMin?: number;
  areaMax?: number;
  quartos?: number;
  banheiros?: number;
  vagas?: number;
  q?: string;
  ordem?: "recentes" | "preco_asc" | "preco_desc" | "area_desc";
  limit?: number;
  offset?: number;
  bounds?: { lat_min: number; lat_max: number; lng_min: number; lng_max: number } | null;
  contrato?: "venda" | "locacao";
  situacao?: string[];
  construtora?: string[];
  empreendimento?: string[];
}

const PROPERTY_MAP_SELECT = "id,codigo,tipo,bairro,cidade,valor_venda,valor_locacao,dormitorios,banheiros,vagas,area_privativa,latitude,longitude,titulo,fotos,empreendimento,construtora,situacao";
const PROPERTY_MAP_PAGE_SIZE = 2000;
const PROPERTY_MAP_MAX_ROWS = 30000;

/* ── Helpers ── */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function slugify(text: string): string {
  return text
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Generate uhome.com.br-compatible slug: tipo-N-quartos-bairro-codigo-JD */
export function gerarSlugUhome(imovel: { tipo: string; quartos: number | null; bairro: string; codigo: string }): string {
  const tipo = slugify(imovel.tipo || "imovel");
  const quartos = imovel.quartos ?? 0;
  const bairro = slugify(imovel.bairro || "");
  const codigo = imovel.codigo || "";
  const suffix = `${codigo}-JD`;
  if (quartos > 0 && bairro) return `${tipo}-${quartos}-quarto${quartos > 1 ? "s" : ""}-${bairro}-${suffix}`;
  if (bairro) return `${tipo}-${bairro}-${suffix}`;
  return `${tipo}-${suffix}`;
}

/** Build the canonical uhome.com.br share URL for a property */
export function shareUrlUhome(imovel: { tipo: string; quartos: number | null; bairro: string; codigo: string }): string {
  return `https://uhome.com.br/imovel/${gerarSlugUhome(imovel)}`;
}

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

export function tituloLimpo(imovel: { tipo: string; quartos: number | null; bairro: string }): string {
  const tipo = capitalize(imovel.tipo);
  const quartos = imovel.quartos ?? 0;
  if (quartos > 0) return `${tipo} ${quartos} quarto${quartos > 1 ? "s" : ""} — ${imovel.bairro}`;
  return `${tipo} para Venda — ${imovel.bairro}`;
}

export function fotoPrincipal(imovel: SiteImovel): string {
  if (imovel.foto_principal) return imovel.foto_principal;
  if (imovel.fotos && imovel.fotos.length > 0) return imovel.fotos[0];
  return "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop";
}

export function formatPreco(preco: number): string {
  if (!preco || preco <= 0) return "Consulte";
  return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function formatPrecoCompact(preco: number): string {
  if (!preco) return "";
  if (preco >= 1_000_000) return `R$${(preco / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (preco >= 1_000) return `R$${Math.round(preco / 1_000)}k`;
  return `R$${preco}`;
}

/* ── Map Typesense doc → SiteImovel ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDoc(doc: any): SiteImovel {
  const fotos: string[] = doc.fotos?.length ? doc.fotos : doc.foto_principal ? [doc.foto_principal] : [];
  const fotosFull: string[] = doc.fotos_full?.length ? doc.fotos_full : fotos;
  const coords = extractCoordinates(doc);
  return {
    id: doc.id || doc.codigo || "",
    slug: doc.slug || doc.codigo || "",
    codigo: doc.codigo || doc.id || "",
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

  return { query: nextQuery, contrato, priceField };
}

async function fetchAllPropertyRows(filters: BuscaFilters = {}) {
  const rows: any[] = [];

  for (let offset = 0; offset < PROPERTY_MAP_MAX_ROWS; offset += PROPERTY_MAP_PAGE_SIZE) {
    let query = supabase.from("properties").select(PROPERTY_MAP_SELECT);
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
  if (error) throw new Error(error.message || "Search failed");

  const docs = (data || []).map(mapDoc);
  return {
    data: docs,
    count: count ?? 0,
    search_time_ms: Date.now() - startTime,
  };
}

/* ── Bairro centroids (Porto Alegre + region) for fallback when lat/lng missing ── */
const BAIRRO_CENTROIDS: Record<string, [number, number]> = {
  "Moinhos de Vento": [-30.0270, -51.1990],
  "Bela Vista": [-30.0450, -51.1900],
  "Mont'Serrat": [-30.0310, -51.2010],
  "Petrópolis": [-30.0420, -51.1780],
  "Três Figueiras": [-30.0310, -51.1700],
  "Boa Vista": [-30.0200, -51.1790],
  "Chácara das Pedras": [-30.0360, -51.1600],
  "Auxiliadora": [-30.0290, -51.1870],
  "Rio Branco": [-30.0350, -51.2030],
  "Independência": [-30.0330, -51.2060],
  "Floresta": [-30.0220, -51.2060],
  "São João": [-30.0250, -51.2120],
  "Centro Histórico": [-30.0310, -51.2280],
  "Centro": [-30.0310, -51.2280],
  "Cidade Baixa": [-30.0410, -51.2220],
  "Menino Deus": [-30.0470, -51.2230],
  "Azenha": [-30.0430, -51.2120],
  "Santana": [-30.0370, -51.2120],
  "Farroupilha": [-30.0370, -51.2120],
  "Partenon": [-30.0560, -51.1730],
  "Santo Antônio": [-30.0340, -51.1640],
  "Jardim Botânico": [-30.0510, -51.1750],
  "Vila Jardim": [-30.0450, -51.1680],
  "Higienópolis": [-30.0350, -51.1930],
  "Passo d'Areia": [-30.0100, -51.1640],
  "São Sebastião": [-30.0120, -51.1540],
  "Cristo Redentor": [-30.0120, -51.1460],
  "Vila Ipiranga": [-30.0160, -51.1370],
  "Jardim Lindóia": [-30.0180, -51.1530],
  "Jardim São Pedro": [-30.0140, -51.1570],
  "São Geraldo": [-30.0160, -51.2010],
  "Navegantes": [-30.0120, -51.2070],
  "Humaitá": [-30.0060, -51.2010],
  "Anchieta": [-30.0030, -51.1950],
  "Sarandi": [-29.9900, -51.1400],
  "Rubem Berta": [-29.9760, -51.1370],
  "Jardim Carvalho": [-30.0350, -51.1500],
  "Vila Nova": [-30.0660, -51.1690],
  "Camaquã": [-30.0810, -51.2170],
  "Cavalhada": [-30.0870, -51.2090],
  "Cristal": [-30.0780, -51.2300],
  "Tristeza": [-30.1020, -51.2370],
  "Ipanema": [-30.1130, -51.2400],
  "Pedra Redonda": [-30.1190, -51.2480],
  "Espírito Santo": [-30.1100, -51.2280],
  "Guarujá": [-30.1200, -51.2220],
  "Nonoai": [-30.0690, -51.2040],
  "Teresópolis": [-30.0670, -51.1870],
  "Glória": [-30.0630, -51.1800],
  "Cascata": [-30.0720, -51.1750],
  "Medianeira": [-30.0570, -51.1940],
  "Santa Tereza": [-30.0460, -51.2050],
  "Praia de Belas": [-30.0460, -51.2350],
  "Hípica": [-30.1370, -51.2070],
  "Restinga": [-30.1520, -51.1800],
  "Belém Velho": [-30.1150, -51.1920],
  "Belém Novo": [-30.1850, -51.1870],
  "Lami": [-30.2400, -51.0780],
  "Vila Assunção": [-30.0970, -51.2470],
  "Vila Conceição": [-30.0890, -51.2460],
  "Serraria": [-30.1280, -51.2070],
  "Aberta dos Morros": [-30.1340, -51.1610],
  "Lomba do Pinheiro": [-30.0870, -51.1320],
  "Agronomia": [-30.0740, -51.1320],
  "Mário Quintana": [-29.9630, -51.0950],
  "Jardim Sabará": [-30.0430, -51.1450],
  "Jardim do Salso": [-30.0730, -51.1570],
  "Santa Cecília": [-30.0290, -51.2080],
  "Bom Fim": [-30.0360, -51.2110],
  "Farrapos": [-29.9970, -51.1720],
  "São José": [-30.0100, -51.1770],
  "Ponta Grossa": [-30.0790, -51.2470],
  "Sétimo Céu": [-30.1200, -51.2510],
  "Jardim Isabel": [-30.0940, -51.1920],
  "Jardim Itu": [-30.0240, -51.1310],
  "Coronel Aparício Borges": [-30.0650, -51.1470],
  "Jardim Floresta": [-29.9980, -51.1640],
  "Santa Maria Goretti": [-29.9810, -51.1630],
  "Jardim Leopoldina": [-29.9710, -51.1520],
  "Vila Jardim Europa": [-30.0570, -51.1530],
  "Passo da Areia": [-30.0100, -51.1640],
  "Morro Santana": [-30.0550, -51.1180],
  "Parque Santa Fé": [-30.0080, -51.1200],
  "Jardim Planalto": [-30.0230, -51.1190],
  "Jardim Europa": [-30.0570, -51.1530],
  "Jardim Dona Leopoldina": [-29.9700, -51.1510],
  "Vila João Pessoa": [-30.0470, -51.2050],
  "Mato Sampaio": [-30.0060, -51.1430],
  "São Caetano": [-30.0030, -51.1790],
  "Conjunto Habitacional Rubem Berta": [-29.9760, -51.1370],
  "Protásio Alves": [-30.0430, -51.1350],
  "Vila São José": [-30.0100, -51.1770],
  "Chapéu do Sol": [-30.1500, -51.2050],
  "Viamão": [-30.0810, -51.0230],
  "Canoas": [-29.9170, -51.1740],
  "Cachoeirinha": [-29.9510, -51.0990],
  "Gravataí": [-29.9440, -50.9920],
  "São Leopoldo": [-29.7600, -51.1470],
  "Novo Hamburgo": [-29.6880, -51.1310],
  "Esteio": [-29.8610, -51.1770],
  "Sapucaia do Sul": [-29.8280, -51.1450],
  "Guaíba": [-30.1130, -51.3250],
  "Alvorada": [-29.9900, -51.0830],
  "Eldorado do Sul": [-30.0860, -51.3720],
};

// Add jitter to avoid stacking pins at same centroid
function jitter(val: number, range = 0.003): number {
  return val + (Math.random() - 0.5) * range;
}

export function siteImovelToMapPin(imovel: SiteImovel, bounds?: BuscaFilters["bounds"]): MapPin | null {
  let lat = imovel.latitude;
  let lng = imovel.longitude;

  if (
    lat == null || lng == null ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat === 0 || lng === 0 ||
    lat < -34 || lat > -27 || lng < -55 || lng > -48
  ) {
    const centroid = BAIRRO_CENTROIDS[imovel.bairro];
    if (!centroid) return null;
    lat = jitter(centroid[0]);
    lng = jitter(centroid[1]);
  }

  if (bounds && (lat < bounds.lat_min || lat > bounds.lat_max || lng < bounds.lng_min || lng > bounds.lng_max)) {
    return null;
  }

  return {
    id: imovel.id,
    slug: imovel.slug,
    preco: imovel.preco,
    latitude: lat,
    longitude: lng,
    bairro: imovel.bairro,
    titulo: imovel.titulo || tituloLimpo({ tipo: imovel.tipo || "imóvel", quartos: imovel.quartos, bairro: imovel.bairro }),
    tipo: imovel.tipo,
    quartos: imovel.quartos,
    area_total: imovel.area_total,
    foto_principal: imovel.foto_principal || undefined,
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

export const CIDADES_PERMITIDAS = ["Porto Alegre", "Canoas", "Cachoeirinha", "Gravataí", "Guaíba"];

export const PROPERTY_TYPES = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "cobertura", label: "Cobertura" },
  { value: "terreno", label: "Terreno" },
  { value: "comercial", label: "Comercial" },
  { value: "loft", label: "Loft" },
  { value: "kitnet", label: "Kitnet" },
];
