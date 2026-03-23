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

/* ── Helpers ── */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
    latitude: doc.latitude ?? null,
    longitude: doc.longitude ?? null,
    titulo: doc.titulo || null,
    endereco: doc.endereco || null,
    _raw: doc,
  };
}

/* ── Build Typesense filter_by ── */

function buildFilterBy(filters: BuscaFilters): string {
  const parts: string[] = [];

  const contrato = filters.contrato || "venda";
  if (contrato === "locacao") {
    parts.push("valor_locacao:>0");
  } else {
    parts.push("valor_venda:>0");
  }

  const bairros = filters.bairros?.length
    ? filters.bairros
    : filters.bairro
    ? filters.bairro.split(",").map(s => s.trim()).filter(Boolean)
    : [];
  if (bairros.length === 1) {
    parts.push(`bairro:=${bairros[0]}`);
  } else if (bairros.length > 1) {
    parts.push(`bairro:[${bairros.join(",")}]`);
  }

  if (filters.tipo) {
    const tipos = filters.tipo.split(",").map(s => s.trim()).filter(Boolean);
    if (tipos.length === 1) parts.push(`tipo:=${tipos[0]}`);
    else if (tipos.length > 1) parts.push(`tipo:[${tipos.join(",")}]`);
  }

  if (filters.quartos) parts.push(`dormitorios:>=${filters.quartos}`);
  if (filters.vagas) parts.push(`vagas:>=${filters.vagas}`);
  if (filters.banheiros) parts.push(`banheiros:>=${filters.banheiros}`);

  const priceField = contrato === "locacao" ? "valor_locacao" : "valor_venda";
  if (filters.precoMin) parts.push(`${priceField}:>=${filters.precoMin}`);
  if (filters.precoMax) parts.push(`${priceField}:<=${filters.precoMax}`);

  if (filters.areaMin) parts.push(`area_privativa:>=${filters.areaMin}`);
  if (filters.areaMax) parts.push(`area_privativa:<=${filters.areaMax}`);

  const cidades = filters.cidades?.length
    ? filters.cidades
    : filters.cidade
    ? [filters.cidade]
    : [];
  if (cidades.length === 1) {
    parts.push(`cidade:=\`${cidades[0]}\``);
  } else if (cidades.length > 1) {
    parts.push(`cidade:[\`${cidades.join("`,`")}\`]`);
  }

  if (filters.situacao?.length) {
    if (filters.situacao.length === 1) {
      parts.push(`status:=\`${filters.situacao[0]}\``);
    } else {
      parts.push(`status:[\`${filters.situacao.join("`,`")}\`]`);
    }
  }

  if (filters.construtora?.length) {
    if (filters.construtora.length === 1) {
      parts.push(`construtora:=\`${filters.construtora[0]}\``);
    } else {
      parts.push(`construtora:[\`${filters.construtora.join("`,`")}\`]`);
    }
  }

  if (filters.empreendimento?.length) {
    if (filters.empreendimento.length === 1) {
      parts.push(`empreendimento:=\`${filters.empreendimento[0]}\``);
    } else {
      parts.push(`empreendimento:[\`${filters.empreendimento.join("`,`")}\`]`);
    }
  }

  return parts.join(" && ");
}

/* ── Build sort_by ── */

function buildSortBy(ordem?: string, contrato?: string): string {
  switch (ordem) {
    case "preco_asc":
      return contrato === "locacao" ? "valor_locacao:asc" : "valor_venda:asc";
    case "preco_desc":
      return contrato === "locacao" ? "valor_locacao:desc" : "valor_venda:desc";
    case "area_desc":
      return "area_privativa:desc";
    default:
      return "data_atualizacao:desc";
  }
}

/* ── API calls via typesense-search edge function ── */

export async function fetchSiteImoveis(filters: BuscaFilters = {}): Promise<{ data: SiteImovel[]; count: number; search_time_ms?: number }> {
  const limit = filters.limit || 24;
  const offset = filters.offset || 0;
  const page = Math.floor(offset / limit) + 1;

  const { data, error } = await supabase.functions.invoke("typesense-search", {
    body: {
      q: filters.q || "*",
      per_page: limit,
      page,
      filter_by: buildFilterBy(filters),
      sort_by: buildSortBy(filters.ordem, filters.contrato),
    },
  });

  if (error) throw new Error(error.message || "Search failed");
  if (data?.error) throw new Error(data.error);

  const docs = (data?.data || []).map(mapDoc);
  return {
    data: docs,
    count: data?.total || 0,
    search_time_ms: data?.search_time_ms,
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
};

// Add jitter to avoid stacking pins at same centroid
function jitter(val: number, range = 0.003): number {
  return val + (Math.random() - 0.5) * range;
}

/**
 * Fetch map pins — uses real lat/lng from Typesense.
 * Falls back to bairro centroids with jitter when coordinates are missing.
 */
export async function fetchMapPins(filters: BuscaFilters = {}): Promise<MapPin[]> {
  const { data, error } = await supabase.functions.invoke("typesense-search", {
    body: {
      q: filters.q || "*",
      per_page: 250,
      page: 1,
      filter_by: buildFilterBy(filters),
      sort_by: buildSortBy(filters.ordem, filters.contrato),
    },
  });

  if (error) return [];

  const bounds = filters.bounds;
  const pins: MapPin[] = [];

  for (const doc of (data?.data || [])) {
    let lat = Number(doc.latitude);
    let lng = Number(doc.longitude);
    let hasRealCoords = true;

    // If no valid coordinates, use bairro centroid with jitter
    if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0 || lat < -34 || lat > -27 || lng < -55 || lng > -48) {
      const bairro = String(doc.bairro || "");
      const centroid = BAIRRO_CENTROIDS[bairro];
      if (centroid) {
        lat = jitter(centroid[0]);
        lng = jitter(centroid[1]);
        hasRealCoords = false;
      } else {
        continue; // No coords and no known bairro — skip
      }
    }

    // Client-side bounds filter
    if (bounds && (lat < bounds.lat_min || lat > bounds.lat_max || lng < bounds.lng_min || lng > bounds.lng_max)) continue;

    const tipo = String(doc.tipo || "imóvel");
    const bairro = String(doc.bairro || "");
    const quartos = doc.dormitorios != null ? Number(doc.dormitorios) : null;

    pins.push({
      id: String(doc.id || doc.codigo || ""),
      slug: String(doc.slug || doc.codigo || ""),
      preco: Number(doc.valor_venda || 0),
      latitude: lat,
      longitude: lng,
      bairro,
      titulo: tituloLimpo({ tipo, quartos, bairro }),
      tipo,
      quartos,
      area_total: doc.area_privativa != null ? Number(doc.area_privativa) : null,
      foto_principal: (doc.fotos as string[])?.[0] || String(doc.foto_principal || ""),
    });
  }

  return pins;
}

export async function fetchBairros(): Promise<BairroCount[]> {
  const { data, error } = await supabase.functions.invoke("typesense-search", {
    body: {
      q: "*",
      per_page: 0,
      facet_by: "bairro",
      max_facet_values: 200,
      filter_by: "valor_venda:>0",
    },
  });

  if (error || !data?.facet_counts) return [];

  const fc = data.facet_counts.find((f: { field_name: string }) => f.field_name === "bairro");
  if (!fc?.counts) return [];

  return fc.counts
    .filter((c: { value: string }) => c.value?.trim())
    .map((c: { value: string; count: number }) => ({ bairro: c.value, count: c.count || 0 }))
    .sort((a: BairroCount, b: BairroCount) => a.bairro.localeCompare(b.bairro, "pt-BR"));
}

export async function fetchImovelBySlug(slug: string): Promise<SiteImovel | null> {
  const { data, error } = await supabase.functions.invoke("typesense-search", {
    body: {
      q: slug,
      query_by: "codigo,slug",
      per_page: 1,
      num_typos: 0,
    },
  });

  if (error || !data?.data?.length) return null;
  return mapDoc(data.data[0]);
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
