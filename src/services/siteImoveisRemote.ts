/**
 * Service for fetching properties from the SITE database (uhome.com.br)
 * via the supabaseSite client. Queries the `imoveis` table directly.
 *
 * Column mapping (site `imoveis` → SiteImovel):
 *   jetimob_id → codigo
 *   preco → preco
 *   area_total → area_total
 *   quartos → quartos
 *   fotos (array of {url,ordem,principal}) → fotos (string[])
 *   condominio_nome → condominio_nome / empreendimento
 *   endereco_completo → endereco
 *   status = 'disponivel' (instead of ativo = true)
 */

import { supabaseSite } from "@/lib/supabaseSite";
import type { SiteImovel, MapPin, BairroCount, BuscaFilters } from "@/services/siteImoveis";
import { siteImovelToMapPin } from "@/services/siteImoveis";

/* ── Column select (keep lean for list queries) ── */
const LIST_SELECT =
  "id,slug,jetimob_id,tipo,finalidade,status,destaque,preco,preco_condominio,area_total,area_util,quartos,banheiros,vagas,andar,bairro,cidade,uf,latitude,longitude,titulo,fotos,foto_principal,condominio_nome,publicado_em,endereco_completo,diferenciais,descricao,video_url";

const MAP_SELECT =
  "id,slug,jetimob_id,tipo,preco,quartos,bairro,cidade,area_total,latitude,longitude,titulo,foto_principal";

const PAGE_SIZE_MAP = 2000;
const MAP_MAX_ROWS = 30000;

/* ── Map DB row → SiteImovel ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDocSite(doc: any): SiteImovel {
  // fotos in site DB is array of {url, ordem, principal}
  const fotosRaw: { url: string; ordem?: number; principal?: boolean }[] = doc.fotos || [];
  const fotosUrls = fotosRaw
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((f) => f.url)
    .filter(Boolean);

  const fotoPrincipal = doc.foto_principal || fotosUrls[0] || null;
  const codigo = doc.jetimob_id || doc.id || "";

  return {
    id: doc.id || "",
    slug: doc.slug || "",
    codigo,
    tipo: doc.tipo || "",
    finalidade: doc.finalidade || "venda",
    status: doc.status || "",
    destaque: doc.destaque ?? false,
    preco: Number(doc.preco || 0),
    preco_condominio: doc.preco_condominio ? Number(doc.preco_condominio) : null,
    area_total: doc.area_total ? Number(doc.area_total) : (doc.area_util ? Number(doc.area_util) : null),
    quartos: doc.quartos != null ? Number(doc.quartos) : null,
    banheiros: doc.banheiros != null ? Number(doc.banheiros) : null,
    vagas: doc.vagas != null ? Number(doc.vagas) : null,
    suites: null, // not in site table
    bairro: doc.bairro || "",
    cidade: doc.cidade || "",
    uf: doc.uf || "RS",
    publicado_em: doc.publicado_em || doc.created_at || "",
    foto_principal: fotoPrincipal,
    fotos: fotosUrls,
    fotos_full: fotosUrls,
    condominio_nome: doc.condominio_nome || null,
    empreendimento: doc.condominio_nome || null,
    construtora: null, // not in site table
    latitude: doc.latitude != null ? Number(doc.latitude) : null,
    longitude: doc.longitude != null ? Number(doc.longitude) : null,
    titulo: doc.titulo || null,
    endereco: doc.endereco_completo || null,
    _raw: doc,
  };
}

/* ── Apply filters to query ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, filters: BuscaFilters = {}) {
  // Only show available properties
  let q = query.eq("status", "disponivel");

  // Price > 1 (some records have preco=0.1 as placeholder)
  q = q.gt("preco", 1);

  // Cidade
  const cidades = filters.cidades?.length ? filters.cidades : filters.cidade ? [filters.cidade] : [];
  if (cidades.length === 1) q = q.eq("cidade", cidades[0]);
  else if (cidades.length > 1) q = q.in("cidade", cidades);

  // Tipo
  if (filters.tipo) {
    const tipos = filters.tipo.split(",").map((s) => s.trim()).filter(Boolean);
    if (tipos.length === 1) q = q.eq("tipo", tipos[0]);
    else if (tipos.length > 1) q = q.in("tipo", tipos);
  }

  // Bairros
  const bairros = filters.bairros?.length
    ? filters.bairros
    : filters.bairro
      ? filters.bairro.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  if (bairros.length === 1) q = q.ilike("bairro", `%${bairros[0]}%`);
  else if (bairros.length > 1) q = q.or(bairros.map((b) => `bairro.ilike.%${b}%`).join(","));

  // Quartos, vagas, banheiros
  if (filters.quartos) q = q.gte("quartos", filters.quartos);
  if (filters.vagas) q = q.gte("vagas", filters.vagas);
  if (filters.banheiros) q = q.gte("banheiros", filters.banheiros);

  // Preço
  if (filters.precoMin) q = q.gte("preco", filters.precoMin);
  if (filters.precoMax) q = q.lte("preco", filters.precoMax);

  // Área
  if (filters.areaMin) q = q.gte("area_total", filters.areaMin);
  if (filters.areaMax) q = q.lte("area_total", filters.areaMax);

  // Condomínio/empreendimento search
  if (filters.condominioNome) {
    q = q.or(`condominio_nome.ilike.%${filters.condominioNome}%,jetimob_id.ilike.%${filters.condominioNome}%`);
  }

  // Bounds (map)
  if (filters.bounds) {
    q = q
      .gte("latitude", filters.bounds.lat_min)
      .lte("latitude", filters.bounds.lat_max)
      .gte("longitude", filters.bounds.lng_min)
      .lte("longitude", filters.bounds.lng_max);
  }

  // Text search
  if (filters.q) {
    q = q.or(`titulo.ilike.%${filters.q}%,bairro.ilike.%${filters.q}%,jetimob_id.ilike.%${filters.q}%,condominio_nome.ilike.%${filters.q}%`);
  }

  // Código
  if (filters.codigo) {
    q = q.ilike("jetimob_id", `%${filters.codigo}%`);
  }

  return q;
}

/* ── Main fetch ── */

export async function fetchSiteImoveisRemote(
  filters: BuscaFilters = {}
): Promise<{ data: SiteImovel[]; count: number; search_time_ms?: number }> {
  const limit = filters.limit || 24;
  const offset = filters.offset || 0;
  const startTime = Date.now();

  let query = supabaseSite
    .from("imoveis")
    .select(LIST_SELECT, { count: "exact" });

  query = applyFilters(query, filters);

  // Sort
  switch (filters.ordem) {
    case "preco_asc":
      query = query.order("preco", { ascending: true, nullsFirst: false });
      break;
    case "preco_desc":
      query = query.order("preco", { ascending: false, nullsFirst: false });
      break;
    case "area_desc":
      query = query.order("area_total", { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order("updated_at", { ascending: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    if (error.code === "PGRST103" || error.message?.includes("Requested range not satisfiable")) {
      return { data: [], count: offset, search_time_ms: Date.now() - startTime };
    }
    throw new Error(error.message || "Search failed");
  }

  const docs = (data || []).map(mapDocSite);
  return {
    data: docs,
    count: count ?? 0,
    search_time_ms: Date.now() - startTime,
  };
}

/* ── Map pins ── */

export async function fetchMapPinsRemote(filters: BuscaFilters = {}): Promise<MapPin[]> {
  const rows: MapPin[] = [];

  for (let offset = 0; offset < MAP_MAX_ROWS; offset += PAGE_SIZE_MAP) {
    let query = supabaseSite.from("imoveis").select(MAP_SELECT);
    query = applyFilters(query, filters);
    const { data, error } = await query.range(offset, offset + PAGE_SIZE_MAP - 1);

    if (error) break;
    if (!data?.length) break;

    for (const doc of data) {
      const mapped = mapDocSite(doc);
      const pin = siteImovelToMapPin(mapped, filters.bounds);
      if (pin) rows.push(pin);
    }

    if (data.length < PAGE_SIZE_MAP) break;
  }

  return rows;
}

/* ── Bairros ── */

export async function fetchBairrosRemote(): Promise<BairroCount[]> {
  // Get distinct bairros from the site's imoveis table
  const { data, error } = await supabaseSite
    .from("imoveis")
    .select("bairro")
    .eq("status", "disponivel")
    .gt("preco", 0);

  if (error || !data?.length) return [];

  // Count manually since we can't do GROUP BY via PostgREST easily
  const counts: Record<string, number> = {};
  for (const row of data) {
    const b = row.bairro?.trim();
    if (b) counts[b] = (counts[b] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([bairro, count]) => ({ bairro, count }))
    .sort((a, b) => a.bairro.localeCompare(b.bairro, "pt-BR"));
}

/* ── Fetch single by slug ── */

export async function fetchImovelBySlugRemote(slug: string): Promise<SiteImovel | null> {
  const { data, error } = await supabaseSite
    .from("imoveis")
    .select(LIST_SELECT)
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapDocSite(data);
}
