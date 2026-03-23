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
  // raw Typesense doc for forward compat
  _raw?: Record<string, unknown>;
}

export interface MapPin {
  id: string;
  slug: string;
  preco: number;
  latitude: number;
  longitude: number;
  bairro: string;
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

  // Default to venda
  const contrato = filters.contrato || "venda";
  if (contrato === "locacao") {
    parts.push("valor_locacao:>0");
  } else {
    parts.push("valor_venda:>0");
  }

  // Bairros
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

  // Tipo
  if (filters.tipo) {
    const tipos = filters.tipo.split(",").map(s => s.trim()).filter(Boolean);
    if (tipos.length === 1) parts.push(`tipo:=${tipos[0]}`);
    else if (tipos.length > 1) parts.push(`tipo:[${tipos.join(",")}]`);
  }

  // Dormitorios
  if (filters.quartos) parts.push(`dormitorios:>=${filters.quartos}`);

  // Vagas
  if (filters.vagas) parts.push(`vagas:>=${filters.vagas}`);

  // Banheiros
  if (filters.banheiros) parts.push(`banheiros:>=${filters.banheiros}`);

  // Price range
  const priceField = contrato === "locacao" ? "valor_locacao" : "valor_venda";
  if (filters.precoMin) parts.push(`${priceField}:>=${filters.precoMin}`);
  if (filters.precoMax) parts.push(`${priceField}:<=${filters.precoMax}`);

  // Area range
  if (filters.areaMin) parts.push(`area_privativa:>=${filters.areaMin}`);
  if (filters.areaMax) parts.push(`area_privativa:<=${filters.areaMax}`);

  // Cidade
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

  // Situação / status
  if (filters.situacao?.length) {
    if (filters.situacao.length === 1) {
      parts.push(`status:=\`${filters.situacao[0]}\``);
    } else {
      parts.push(`status:[\`${filters.situacao.join("`,`")}\`]`);
    }
  }

  // Construtora
  if (filters.construtora?.length) {
    if (filters.construtora.length === 1) {
      parts.push(`construtora:=\`${filters.construtora[0]}\``);
    } else {
      parts.push(`construtora:[\`${filters.construtora.join("`,`")}\`]`);
    }
  }

  // Empreendimento
  if (filters.empreendimento?.length) {
    if (filters.empreendimento.length === 1) {
      parts.push(`empreendimento:=\`${filters.empreendimento[0]}\``);
    } else {
      parts.push(`empreendimento:[\`${filters.empreendimento.join("`,`")}\`]`);
    }
  }

  // Geo bounds — use Typesense geopoint 'location' field
  if (filters.bounds) {
    const { lat_min, lat_max, lng_min, lng_max } = filters.bounds;
    // location:(lat_min, lng_min, lat_max, lng_max) — bounding box
    parts.push(`location:(${lat_min}, ${lng_min}, ${lat_max}, ${lng_max})`);
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

export async function fetchMapPins(filters: BuscaFilters = {}): Promise<MapPin[]> {
  const { data, error } = await supabase.functions.invoke("typesense-search", {
    body: {
      q: filters.q || "*",
      per_page: 250,
      page: 1,
      filter_by: buildFilterBy({ ...filters, bounds: filters.bounds }) + " && location:(-35, -55, -27, -45)",
      sort_by: buildSortBy(filters.ordem, filters.contrato),
    },
  });

  if (error) return [];

  return (data?.data || [])
    .filter((doc: Record<string, unknown>) => doc.latitude && doc.longitude)
    .map((doc: Record<string, unknown>): MapPin => ({
      id: String(doc.id || doc.codigo || ""),
      slug: String(doc.slug || doc.codigo || ""),
      preco: Number(doc.valor_venda || 0),
      latitude: Number(doc.latitude),
      longitude: Number(doc.longitude),
      bairro: String(doc.bairro || ""),
      tipo: String(doc.tipo || ""),
      quartos: doc.dormitorios != null ? Number(doc.dormitorios) : null,
      area_total: doc.area_privativa != null ? Number(doc.area_privativa) : null,
      foto_principal: (doc.fotos as string[])?.[0] || String(doc.foto_principal || ""),
    }));
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
