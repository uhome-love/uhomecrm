import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Helpers ───
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function getPrice(item: any, contrato?: string): number {
  if (contrato === "locacao") {
    const loc = Number(item.valor_locacao || item.preco_locacao || item.valor_aluguel || 0);
    if (loc > 0) return loc;
  }
  const venda = Number(item.valor_venda || item.preco_venda || item.valor || item.price || 0);
  if (venda > 0) return venda;
  const loc = Number(item.valor_locacao || item.preco_locacao || item.valor_aluguel || 0);
  return loc > 0 ? loc : 0;
}

function getDorms(item: any): number {
  return Number(item.dormitorios || item.quartos || item.dorms || item.suites || 0) || 0;
}

function getBairro(item: any): string {
  return String(item.endereco_bairro || item.bairro || item.endereco?.bairro || "");
}

function getTipo(item: any): string {
  return String(item.subtipo || item.tipo_imovel || item.tipo || "").toLowerCase();
}

function normalizeCodigoValue(value: unknown): string {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

function extractCodigoNumber(value: unknown): string {
  return (String(value || "").match(/\d+/g) || []).join("");
}

function isCodigoMatch(item: any, requestedCodigo: string): boolean {
  const requestedNorm = normalizeCodigoValue(requestedCodigo);
  const requestedNum = extractCodigoNumber(requestedCodigo);
  const candidates = [item?.codigo, item?.codigo_imovel, item?.referencia, item?.id_imovel, item?.id, item?.slug];
  const directMatch = candidates.some((candidate) => {
    const candidateNorm = normalizeCodigoValue(candidate);
    if (!candidateNorm) return false;
    if (candidateNorm === requestedNorm) return true;
    const candidateNum = extractCodigoNumber(candidate);
    return !!requestedNum && !!candidateNum && candidateNum === requestedNum;
  });
  if (directMatch) return true;
  const meta = normalizeCodigoValue(
    [item?.titulo_anuncio, item?.url, item?.link, item?.referencia_externa].filter(Boolean).join(" ")
  );
  return !!requestedNum && !!meta && meta.includes(requestedNum);
}

function normalizeImages(imovel: any, _logCodigo?: string): { thumbs: string[]; full: string[] } {
  const thumbs: string[] = [];
  const full: string[] = [];
  if (imovel.foto_principal) { thumbs.push(imovel.foto_principal); full.push(imovel.foto_principal); }
  if (imovel.foto_destaque && imovel.foto_destaque !== imovel.foto_principal) { thumbs.push(imovel.foto_destaque); full.push(imovel.foto_destaque); }
  const imgFieldNames = ["imagens", "fotos", "galeria", "photos", "images", "fotos_imovel", "galeria_fotos", "midia", "midias"];
  for (const fieldName of imgFieldNames) {
    const arr = imovel[fieldName];
    if (Array.isArray(arr) && arr.length > 0) {
      for (const item of arr) {
        if (typeof item === "string") {
          if (item && !thumbs.includes(item)) thumbs.push(item);
          if (item && !full.includes(item)) full.push(item);
        } else if (item && typeof item === "object") {
          const thumb = item.link_thumb || item.link || item.url || item.arquivo || item.src || item.path || item.foto || item.imagem || "";
          const fullUrl = item.link_large || item.link || item.link_medio || item.link_thumb || item.url || item.arquivo || item.src || "";
          if (thumb && !thumbs.includes(thumb)) thumbs.push(thumb);
          if (fullUrl && !full.includes(fullUrl)) full.push(fullUrl);
        }
      }
    }
  }
  return { thumbs, full };
}

// ─── UH-code mapping ───
const UH_CODE_MAP: Record<string, string> = {
  "4688-UH": "Casa Bastian", "97325-UH": "Shift", "91245-UH": "Melnick Day - Alto Padrão",
  "41190-UH": "Las Casas", "58935-UH": "Lake Eyre", "32849-UH": "Open Bosque",
  "76953-UH": "Melnick Day - Médio Padrão", "52101-UH": "Casa Tua",
  "39808-UH": "Melnick Day Compactos", "57290-UH": "Orygem",
};

function resolveUhCode(codigo: string): string | null {
  return UH_CODE_MAP[codigo.toUpperCase().trim()] || null;
}

// ─── Catalog cache (15 min TTL for performance) ───
let jetimobCatalogCache: { fetchedAt: number; items: any[] } | null = null;
const JETIMOB_CATALOG_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Pre-built search index for fast text search
let searchIndex: { item: any; searchText: string; bairroNorm: string; tipoNorm: string; codigo: string }[] | null = null;

function buildSearchIndex(items: any[]) {
  searchIndex = items.map(item => {
    const titulo = normalize(item.titulo_anuncio || item.titulo || "");
    const bairro = normalize(getBairro(item));
    const empreendimento = normalize(item.empreendimento_nome || item.empreendimento || item.condominio || "");
    const endereco = normalize(item.endereco_logradouro || item.endereco?.logradouro || item.endereco_completo || "");
    const codigo = String(item.codigo || item.referencia || item.id_imovel || "").toLowerCase();
    const tipo = normalize(getTipo(item));
    return {
      item,
      searchText: `${titulo} ${bairro} ${empreendimento} ${endereco} ${codigo}`,
      bairroNorm: bairro,
      tipoNorm: tipo,
      codigo: codigo,
    };
  });
}

async function fetchJetimobCatalog(apiKey: string): Promise<any[]> {
  if (jetimobCatalogCache && Date.now() - jetimobCatalogCache.fetchedAt < JETIMOB_CATALOG_TTL_MS) {
    return jetimobCatalogCache.items;
  }

  console.time("jetimob-catalog-fetch");
  const batchSize = 500;
  const maxPages = 60; // up to 30k items
  let allItems: any[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = `https://api.jetimob.com/webservice/${apiKey}/imoveis/todos?v=6&page=${page}&pageSize=${batchSize}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) break;
    const raw = await response.json();
    const items = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.result) ? raw.result : Array.isArray(raw) ? raw : [];
    if (!items.length) break;
    allItems = allItems.concat(items);
    const rawTotal = raw?.total || raw?.totalResults || raw?.total_results || 0;
    if (items.length < batchSize || (rawTotal > 0 && allItems.length >= rawTotal)) break;
  }

  jetimobCatalogCache = { fetchedAt: Date.now(), items: allItems };
  buildSearchIndex(allItems);
  console.timeEnd("jetimob-catalog-fetch");
  console.log("Jetimob catalog cached:", allItems.length, "items");
  return allItems;
}

async function findImoveisByCodigos(apiKey: string, codigos: string[]): Promise<Record<string, any | null>> {
  const wanted = codigos.map(c => String(c || "").trim()).filter(Boolean);
  const pending = new Set(wanted);
  const found = new Map<string, any>();
  const catalogItems = await fetchJetimobCatalog(apiKey);

  // Phase 1: UH-code mapping
  for (const codigo of Array.from(pending)) {
    const empName = resolveUhCode(codigo);
    if (empName) {
      const empLower = normalize(empName);
      const match = catalogItems.find((item: any) => {
        const itemEmp = normalize(item.empreendimento_nome || item.empreendimento || item.condominio || "");
        const itemTitulo = normalize(item.titulo_anuncio || item.titulo || "");
        return itemEmp.includes(empLower) || empLower.includes(itemEmp) || itemTitulo.includes(empLower);
      });
      if (match) { found.set(codigo, match); pending.delete(codigo); continue; }
    }
  }

  // Phase 2: Direct match in catalog
  for (const item of catalogItems) {
    for (const codigo of Array.from(pending)) {
      if (isCodigoMatch(item, codigo)) { found.set(codigo, item); pending.delete(codigo); }
    }
    if (pending.size === 0) break;
  }

  const out: Record<string, any | null> = {};
  for (const codigo of wanted) out[codigo] = found.get(codigo) || null;
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const JETIMOB_API_KEY = Deno.env.get("JETIMOB_API_KEY");
    if (!JETIMOB_API_KEY) throw new Error("JETIMOB_API_KEY is not configured");

    const body = await req.json();
    const { action, codigo, broker_id } = body;

    // ═══════════════════════════════════════════
    // GET SINGLE IMOVEL
    // ═══════════════════════════════════════════
    if (action === "get_imovel") {
      const requestedCodigo = String(codigo || "").trim();
      if (!requestedCodigo) {
        return new Response(JSON.stringify({ error: "Código do imóvel é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Try catalog first (fastest path)
      const catalogItems = await fetchJetimobCatalog(JETIMOB_API_KEY);
      let imovel = catalogItems.find(item => isCodigoMatch(item, requestedCodigo)) || null;

      // Fallback to direct API
      if (!imovel) {
        const directUrl = `https://api.jetimob.com/webservice/${JETIMOB_API_KEY}/imoveis/codigo/${encodeURIComponent(requestedCodigo)}?v=6`;
        const response = await fetch(directUrl, { headers: { Accept: "application/json" } });
        if (response.ok) {
          const raw = await response.json();
          const items = Array.isArray(raw?.data) ? raw.data : raw?.imovel ? [raw.imovel] : raw?.codigo ? [raw] : [];
          imovel = items.find((item: any) => isCodigoMatch(item, requestedCodigo)) || items[0] || null;
        }
      }

      if (imovel) {
        const imgs = normalizeImages(imovel, requestedCodigo);
        imovel._fotos_normalized = imgs.thumbs;
        imovel._fotos_full = imgs.full;
      }

      return new Response(JSON.stringify({ imovel, not_found: !imovel }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════
    // GET MULTIPLE IMOVEIS BY CODIGOS
    // ═══════════════════════════════════════════
    if (action === "get_imoveis_by_codigos") {
      const codigos = Array.isArray(body?.codigos) ? body.codigos.map((c: any) => String(c || "").trim()).filter(Boolean) : [];
      if (!codigos.length) {
        return new Response(JSON.stringify({ error: "Lista de códigos é obrigatória" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const foundMap = await findImoveisByCodigos(JETIMOB_API_KEY, codigos);
      const imoveis: Record<string, any> = {};
      for (const c of codigos) {
        const matched = foundMap[c] || null;
        if (matched) {
          const imgs = normalizeImages(matched, c);
          imoveis[c] = { ...matched, _fotos_normalized: imgs.thumbs, _fotos_full: imgs.full };
        } else {
          imoveis[c] = null;
        }
      }
      return new Response(JSON.stringify({ imoveis }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════════════════════════════════════
    // LIST LEADS
    // ═══════════════════════════════════════════
    if (action === "list_leads") {
      const JETIMOB_LEADS_URL_KEY = Deno.env.get("JETIMOB_LEADS_URL_KEY");
      if (!JETIMOB_LEADS_URL_KEY) throw new Error("JETIMOB_LEADS_URL_KEY is not configured");
      const url = `https://api.jetimob.com/leads/${JETIMOB_LEADS_URL_KEY}`;
      const JETIMOB_LEADS_PRIVATE_KEY = Deno.env.get("JETIMOB_LEADS_PRIVATE_KEY");
      if (!JETIMOB_LEADS_PRIVATE_KEY) throw new Error("JETIMOB_LEADS_PRIVATE_KEY is not configured");
      const response = await fetch(url, { method: "GET", headers: { "Authorization-Key": JETIMOB_LEADS_PRIVATE_KEY } });
      const text = await response.text();
      if (!response.ok) {
        return new Response(JSON.stringify({ error: `Erro ao buscar leads: ${response.status}`, details: text }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let data = JSON.parse(text);
      if (broker_id) {
        const results = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];
        data = { result: results.filter((lead: any) => String(lead.broker_id || lead.responsavel_id || lead.user_id) === String(broker_id)) };
      }
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════════════════════════════════════
    // LIST IMOVEIS — OPTIMIZED WITH CATALOG CACHE
    // ═══════════════════════════════════════════
    if (action === "list_imoveis") {
      const { page = 1, pageSize = 24, search, contrato, tipo, bairro, dormitorios, suites, vagas, area_min, area_max, valor_min, valor_max, search_uhome, somente_obras } = body;
      
      console.time("list_imoveis");

      // Always use catalog cache — this is the key optimization
      const allItems = await fetchJetimobCatalog(JETIMOB_API_KEY);
      
      // Ensure search index exists
      if (!searchIndex) buildSearchIndex(allItems);
      
      let results = searchIndex!;

      // ─── Text search (searches titulo, bairro, empreendimento, endereco, codigo) ───
      if (search) {
        const searchTerms = normalize(search).split(/\s+/).filter(Boolean);
        results = results.filter(entry => searchTerms.every(term => entry.searchText.includes(term)));
      }

      // ─── uHome filter ───
      if (search_uhome) {
        results = results.filter(entry => entry.codigo.includes("-uh"));
      }

      // ─── Bairro filter ───
      if (bairro) {
        const bairroNorm = normalize(bairro);
        results = results.filter(entry => entry.bairroNorm.includes(bairroNorm) || bairroNorm.includes(entry.bairroNorm));
      }

      // ─── Tipo filter ───
      if (tipo && tipo !== "all") {
        const tipoNorm = normalize(tipo);
        results = results.filter(entry => entry.tipoNorm.includes(tipoNorm) || tipoNorm.includes(entry.tipoNorm));
      }

      // ─── Dormitórios ───
      if (dormitorios && dormitorios !== "all") {
        const min = Number(dormitorios);
        if (min > 0) results = results.filter(entry => getDorms(entry.item) >= min);
      }

      // ─── Suítes ───
      if (suites && suites !== "all") {
        const min = Number(suites);
        if (min > 0) results = results.filter(entry => Number(entry.item.suites || 0) >= min);
      }

      // ─── Vagas ───
      if (vagas && vagas !== "all") {
        const min = Number(vagas);
        if (min > 0) results = results.filter(entry => Number(entry.item.garagens || entry.item.vagas || 0) >= min);
      }

      // ─── Valor min/max ───
      if (valor_min) {
        const min = Number(valor_min);
        if (min > 0) results = results.filter(entry => getPrice(entry.item, contrato) >= min);
      }
      if (valor_max) {
        const max = Number(valor_max);
        if (max > 0) results = results.filter(entry => { const p = getPrice(entry.item, contrato); return p > 0 && p <= max; });
      }

      // ─── Área min/max ───
      if (area_min) {
        const min = Number(area_min);
        if (min > 0) results = results.filter(entry => Number(entry.item.area_privativa || entry.item.area_util || entry.item.area_total || 0) >= min);
      }
      if (area_max) {
        const max = Number(area_max);
        if (max > 0) results = results.filter(entry => { const a = Number(entry.item.area_privativa || entry.item.area_util || entry.item.area_total || 0); return a > 0 && a <= max; });
      }

      // ─── Somente obras ───
      if (somente_obras) {
        results = results.filter(entry => {
          const situacao = normalize(entry.item.situacao || entry.item.status || entry.item.fase || "");
          return situacao.includes("obra") || situacao.includes("constru") || situacao.includes("planta") || situacao.includes("lancamento");
        });
      }

      // ─── Pagination ───
      const totalFiltered = results.length;
      const totalPagesCalc = Math.ceil(totalFiltered / pageSize) || 1;
      const start = (page - 1) * pageSize;
      const paginatedResults = results.slice(start, start + pageSize);

      // Normalize images only for the paginated results (not all items)
      const paginatedItems = paginatedResults.map(entry => {
        const imgs = normalizeImages(entry.item);
        return {
          ...entry.item,
          _fotos_normalized: imgs.thumbs,
          _fotos_full: imgs.full,
        };
      });

      console.timeEnd("list_imoveis");
      console.log(`list_imoveis: ${totalFiltered} filtered, page ${page}/${totalPagesCalc}, returning ${paginatedItems.length}`);

      return new Response(JSON.stringify({
        data: paginatedItems,
        total: totalFiltered,
        totalPages: totalPagesCalc,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════
    // AUTOCOMPLETE — lightweight endpoint for search suggestions
    // ═══════════════════════════════════════════
    if (action === "autocomplete") {
      const q = normalize(String(body.query || ""));
      if (!q || q.length < 2) {
        return new Response(JSON.stringify({ suggestions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await fetchJetimobCatalog(JETIMOB_API_KEY);
      if (!searchIndex) return new Response(JSON.stringify({ suggestions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const bairros = new Set<string>();
      const empreendimentos = new Set<string>();
      const codigos: string[] = [];

      for (const entry of searchIndex) {
        if (!entry.searchText.includes(q)) continue;
        
        const b = getBairro(entry.item);
        if (b && normalize(b).includes(q)) bairros.add(b);
        
        const emp = entry.item.empreendimento_nome || entry.item.empreendimento || entry.item.condominio || "";
        if (emp && normalize(emp).includes(q)) empreendimentos.add(emp);
        
        const cod = String(entry.item.codigo || "");
        if (cod && cod.toLowerCase().includes(q)) codigos.push(cod);

        if (bairros.size + empreendimentos.size + codigos.length >= 15) break;
      }

      return new Response(JSON.stringify({
        suggestions: [
          ...[...bairros].slice(0, 5).map(b => ({ type: "bairro", value: b })),
          ...[...empreendimentos].slice(0, 5).map(e => ({ type: "empreendimento", value: e })),
          ...codigos.slice(0, 5).map(c => ({ type: "codigo", value: c })),
        ],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("jetimob-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
