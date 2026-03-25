/**
 * imoveis.ts — Service layer for property search via PostgREST.
 * Replaces Typesense-based search with direct Supabase queries.
 */

import { supabase } from "@/integrations/supabase/client";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Lightweight columns for listing (no fotos array, descricao, jetimob_raw)
const LISTING_COLUMNS = `
  id, codigo, tipo, contrato, situacao, ativo,
  is_destaque, is_exclusivo, is_uhome,
  valor_venda, valor_locacao, valor_condominio, valor_iptu,
  area_total, area_privativa,
  dormitorios, suites, banheiros, vagas, andar,
  bairro, cidade, estado, latitude, longitude,
  titulo, empreendimento, construtora,
  fotos, fotos_full, tags, features,
  created_at, updated_at
`.replace(/\s+/g, " ").trim();

export interface ImoveisFilters {
  tipo?: string;        // comma-separated or single
  tipos?: string[];
  bairro?: string;      // single bairro (ilike)
  bairros?: string[];   // multi-select
  cidade?: string;
  cidades?: string[];
  precoMin?: number;
  precoMax?: number;
  areaMin?: number;
  areaMax?: number;
  quartos?: number;
  banheiros?: number;
  vagas?: number;
  diferenciais?: string[];
  andarMin?: number;
  condominioMax?: number;
  iptuMax?: number;
  q?: string;           // texto livre
  codigo?: string;      // busca por código
  bounds?: { lat_min: number; lat_max: number; lng_min: number; lng_max: number };
  ordem?: "recentes" | "preco_asc" | "preco_desc" | "area_desc";
  limit?: number;
  offset?: number;
}

export interface Imovel {
  id: string;
  codigo: string;
  tipo: string;
  contrato: string;
  situacao: string;
  titulo: string;
  valor_venda: number | null;
  valor_locacao: number | null;
  valor_condominio: number | null;
  area_total: number | null;
  area_privativa: number | null;
  dormitorios: number;
  suites: number;
  banheiros: number;
  vagas: number;
  bairro: string;
  cidade: string;
  latitude: number | null;
  longitude: number | null;
  empreendimento: string | null;
  construtora: string | null;
  fotos: string[];
  fotos_full: string[];
  is_destaque: boolean;
  is_exclusivo: boolean;
  is_uhome: boolean;
  tags: string[];
  features: any;
  [key: string]: any;
}

export interface ImoveisResult {
  data: Imovel[];
  count: number;
}

const CIDADES_PERMITIDAS = ["Porto Alegre", "Canoas", "Cachoeirinha", "Gravataí", "Guaíba"];

export async function fetchImoveis(filters: ImoveisFilters): Promise<ImoveisResult> {
  let query = supabase
    .from("properties")
    .select(LISTING_COLUMNS, { count: filters.offset ? undefined : "exact" })
    .eq("ativo", true);

  // Cidade
  if (filters.cidade) {
    query = query.eq("cidade", filters.cidade);
  } else if (filters.cidades?.length) {
    query = query.in("cidade", filters.cidades);
  } else {
    query = query.in("cidade", CIDADES_PERMITIDAS);
  }

  // Tipo
  if (filters.tipos?.length) {
    query = query.in("tipo", filters.tipos);
  } else if (filters.tipo) {
    const tipos = filters.tipo.split(",").filter(Boolean);
    if (tipos.length === 1) query = query.eq("tipo", tipos[0]);
    else if (tipos.length > 1) query = query.in("tipo", tipos);
  }

  // Bairros
  if (filters.bairros?.length) {
    const orParts = filters.bairros.map(b => `bairro.ilike.%${b}%`).join(",");
    query = query.or(orParts);
  } else if (filters.bairro) {
    query = query.ilike("bairro", `%${filters.bairro}%`);
  }

  // Preço
  if (filters.precoMin && filters.precoMin > 0) query = query.gte("valor_venda", filters.precoMin);
  if (filters.precoMax && filters.precoMax > 0) query = query.lte("valor_venda", filters.precoMax);

  // Área
  if (filters.areaMin && filters.areaMin > 0) query = query.gte("area_total", filters.areaMin);
  if (filters.areaMax && filters.areaMax > 0 && filters.areaMax < 500) query = query.lte("area_total", filters.areaMax);

  // Quartos / banheiros / vagas
  if (filters.quartos && filters.quartos > 0) query = query.gte("dormitorios", filters.quartos);
  if (filters.banheiros && filters.banheiros > 0) query = query.gte("banheiros", filters.banheiros);
  if (filters.vagas && filters.vagas > 0) query = query.gte("vagas", filters.vagas);

  // Avançados
  if (filters.andarMin) query = query.gte("andar", filters.andarMin);
  if (filters.condominioMax) query = query.lte("valor_condominio", filters.condominioMax);
  if (filters.iptuMax) query = query.lte("valor_iptu", filters.iptuMax);

  // Diferenciais
  if (filters.diferenciais?.length) {
    query = query.contains("features", { diferenciais: filters.diferenciais });
  }

  // Texto livre
  if (filters.q) {
    query = query.or(`titulo.ilike.%${filters.q}%,bairro.ilike.%${filters.q}%,tipo.ilike.%${filters.q}%`);
  }

  // Código
  if (filters.codigo) {
    query = query.or(`codigo.ilike.%${filters.codigo}%,jetimob_id.ilike.%${filters.codigo}%`);
  }

  // Bounds (mapa)
  if (filters.bounds) {
    query = query
      .gte("latitude", filters.bounds.lat_min)
      .lte("latitude", filters.bounds.lat_max)
      .gte("longitude", filters.bounds.lng_min)
      .lte("longitude", filters.bounds.lng_max);
  }

  // Ordenação
  switch (filters.ordem) {
    case "preco_asc":
      query = query.order("valor_venda", { ascending: true, nullsFirst: false });
      break;
    case "preco_desc":
      query = query.order("valor_venda", { ascending: false, nullsFirst: false });
      break;
    case "area_desc":
      query = query.order("area_total", { ascending: false, nullsFirst: false });
      break;
    case "recentes":
    default:
      query = query.order("updated_at", { ascending: false });
      break;
  }

  // Paginação
  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("fetchImoveis error:", error);
    throw error;
  }

  return {
    data: (data || []) as Imovel[],
    count: count ?? 0,
  };
}

/**
 * Fetch bairros with counts for autocomplete
 */
export async function fetchBairros(cidade?: string): Promise<{ bairro: string; count: number }[]> {
  const { data, error } = await supabase.rpc("get_bairros_disponiveis", {
    p_cidade: cidade || null,
  });
  if (error) {
    console.error("fetchBairros error:", error);
    return [];
  }
  return data || [];
}
