import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const COLLECTION_NAME = "imoveis";

const SCHEMA = {
  name: COLLECTION_NAME,
  fields: [
    { name: "codigo", type: "string" as const, facet: true },
    { name: "titulo", type: "string" as const, optional: true as const },
    { name: "descricao_resumida", type: "string" as const, optional: true as const },
    { name: "bairro", type: "string" as const, facet: true, optional: true as const },
    { name: "cidade", type: "string" as const, facet: true, optional: true as const },
    { name: "endereco", type: "string" as const, optional: true as const },
    { name: "empreendimento", type: "string" as const, facet: true, optional: true as const },
    { name: "construtora", type: "string" as const, facet: true, optional: true as const },
    { name: "tipo", type: "string" as const, facet: true, optional: true as const },
    { name: "categoria", type: "string" as const, facet: true, optional: true as const },
    { name: "contrato", type: "string" as const, facet: true, optional: true as const },
    { name: "valor_venda", type: "float" as const, optional: true as const },
    { name: "valor_locacao", type: "float" as const, optional: true as const },
    { name: "area_privativa", type: "float" as const, optional: true as const },
    { name: "area_total", type: "float" as const, optional: true as const },
    { name: "dormitorios", type: "int32" as const, optional: true as const, facet: true as const },
    { name: "suites", type: "int32" as const, optional: true as const, facet: true as const },
    { name: "banheiros", type: "int32" as const, optional: true as const },
    { name: "vagas", type: "int32" as const, optional: true as const, facet: true as const },
    { name: "status", type: "string" as const, facet: true, optional: true as const },
    { name: "situacao", type: "string" as const, facet: true, optional: true as const },
    { name: "foto_principal", type: "string" as const, optional: true as const },
    { name: "fotos", type: "string[]" as const, optional: true as const },
    { name: "fotos_full", type: "string[]" as const, optional: true as const },
    { name: "destaque", type: "bool" as const, optional: true as const },
    { name: "em_obras", type: "bool" as const, optional: true as const },
    { name: "previsao_entrega", type: "string" as const, optional: true as const },
    { name: "valor_condominio", type: "float" as const, optional: true as const },
    { name: "is_uhome", type: "bool" as const, optional: true as const, facet: true as const },
    { name: "data_atualizacao", type: "int64" as const },
    // Geo fields for map
    { name: "latitude", type: "float" as const, optional: true as const },
    { name: "longitude", type: "float" as const, optional: true as const },
    { name: "location", type: "geopoint" as const, optional: true as const },
  ],
  default_sorting_field: "data_atualizacao",
  token_separators: ["-", "/"],
};

async function typesenseFetch(host: string, apiKey: string, path: string, options: RequestInit = {}) {
  const url = `https://${host}${path}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      "X-TYPESENSE-API-KEY": apiKey,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await resp.text();
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Typesense ${resp.status}: ${text}`);
  }
  return { status: resp.status, data: text ? JSON.parse(text) : null };
}

function normalizeImages(imovel: any): { thumbs: string[]; full: string[] } {
  const thumbs: string[] = [];
  const full: string[] = [];

  if (imovel.foto_principal) {
    thumbs.push(imovel.foto_principal);
    full.push(imovel.foto_principal);
  }
  if (imovel.foto_destaque && imovel.foto_destaque !== imovel.foto_principal) {
    thumbs.push(imovel.foto_destaque);
    full.push(imovel.foto_destaque);
  }

  const imgFieldNames = ["imagens", "fotos", "galeria", "photos", "images"];
  for (const fieldName of imgFieldNames) {
    const arr = imovel[fieldName];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item === "string") {
          if (!thumbs.includes(item)) thumbs.push(item);
          if (!full.includes(item)) full.push(item);
        } else if (item && typeof item === "object") {
          // Thumb: prefer link_thumb > link
          const thumb = item.link_thumb || item.link || item.url || item.arquivo || "";
          // Full: prefer link_large > link > link_medio > link_thumb
          const fullUrl = item.link_large || item.link || item.link_medio || item.link_thumb || item.url || item.arquivo || "";
          if (thumb && !thumbs.includes(thumb)) thumbs.push(thumb);
          if (fullUrl && !full.includes(fullUrl)) full.push(fullUrl);
        }
      }
    }
  }
  return { thumbs, full };
}

function mapImovelToDocument(item: any): Record<string, any> {
  const codigo = String(item.codigo || item.referencia || item.id_imovel || item.id || "");
  const { thumbs, full } = normalizeImages(item);
  const situacao = String(item.situacao || item.status || item.fase || "").toLowerCase();
  const emObras = situacao.includes("obra") || situacao.includes("constru") || situacao.includes("planta") || situacao.includes("lancamento");

  // Extract coordinates
  const lat = Number(item.latitude || item.lat || item.endereco_latitude || item.endereco?.latitude || 0);
  const lng = Number(item.longitude || item.lng || item.lon || item.endereco_longitude || item.endereco?.longitude || 0);
  const hasCoords = lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng) && lat >= -35 && lat <= 5 && lng >= -75 && lng <= -30;

  const doc: Record<string, any> = {
    id: codigo || `auto_${Math.random().toString(36).slice(2)}`,
    codigo,
    titulo: item.titulo_anuncio || item.empreendimento_nome || item.titulo || "",
    descricao_resumida: (item.descricao || item.descricao_interna || "").slice(0, 500),
    bairro: item.endereco_bairro || item.bairro || item.endereco?.bairro || "",
    cidade: item.endereco_cidade || item.cidade || item.endereco?.cidade || "Porto Alegre",
    endereco: [item.endereco_logradouro || item.endereco || "", item.endereco_numero || ""].filter(Boolean).join(", "),
    empreendimento: item.empreendimento_nome || item.empreendimento || item.condominio || "",
    construtora: item.construtora || item.incorporadora || "",
    tipo: (item.subtipo || item.tipo_imovel || item.tipo || "").toLowerCase(),
    categoria: item.categoria || "",
    contrato: item.finalidade || item.contrato || "venda",
    valor_venda: Number(item.valor_venda || item.preco_venda || item.valor || 0) || 0,
    valor_locacao: Number(item.valor_locacao || item.preco_locacao || item.valor_aluguel || 0) || 0,
    area_privativa: Number(item.area_privativa || item.area_util || 0) || 0,
    area_total: Number(item.area_total || 0) || 0,
    dormitorios: Number(item.dormitorios || item.quartos || 0) || 0,
    suites: Number(item.suites || 0) || 0,
    banheiros: Number(item.banheiros || 0) || 0,
    vagas: Number(item.garagens || item.vagas || 0) || 0,
    status: item.status || "",
    situacao: situacao,
    foto_principal: thumbs[0] || "",
    fotos: thumbs.slice(0, 15),
    fotos_full: full.slice(0, 15),
    destaque: !!item.destaque,
    em_obras: emObras,
    previsao_entrega: item.previsao_entrega || item.data_entrega || "",
    valor_condominio: Number(item.valor_condominio || 0) || 0,
    is_uhome: String(item.codigo || "").toLowerCase().includes("-uh"),
    data_atualizacao: Date.now(),
  };

  if (hasCoords) {
    doc.latitude = lat;
    doc.longitude = lng;
    doc.location = [lat, lng];
  }

  return doc;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require authenticated user (from frontend)
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const sb = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authErr } = await sb.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const TYPESENSE_HOST = Deno.env.get("TYPESENSE_HOST");
    const TYPESENSE_ADMIN_API_KEY = Deno.env.get("TYPESENSE_ADMIN_API_KEY");
    if (!TYPESENSE_HOST || !TYPESENSE_ADMIN_API_KEY) {
      throw new Error("Typesense credentials not configured");
    }

    const body = await req.json();
    const { action } = body;

    // ═══ CREATE COLLECTION ═══
    if (action === "create_collection") {
      // Drop if exists
      await typesenseFetch(TYPESENSE_HOST, TYPESENSE_ADMIN_API_KEY, `/collections/${COLLECTION_NAME}`, { method: "DELETE" }).catch(() => {});
      const result = await typesenseFetch(TYPESENSE_HOST, TYPESENSE_ADMIN_API_KEY, "/collections", {
        method: "POST",
        body: JSON.stringify(SCHEMA),
      });
      return new Response(JSON.stringify({ success: true, collection: result.data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ FULL REINDEX ═══
    if (action === "reindex") {
      const JETIMOB_API_KEY = Deno.env.get("JETIMOB_API_KEY");
      if (!JETIMOB_API_KEY) throw new Error("JETIMOB_API_KEY not configured");

      // Fetch all items from Jetimob
      console.time("jetimob-fetch-for-reindex");
      const batchSize = body.batchSize || 500;
      const maxPages = body.maxPages || 60;
      let allItems: any[] = [];
      for (let page = 1; page <= maxPages; page++) {
        const url = `https://api.jetimob.com/webservice/${JETIMOB_API_KEY}/imoveis/todos?v=6&page=${page}&pageSize=${batchSize}`;
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) break;
        const raw = await response.json();
        const items = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.result) ? raw.result : Array.isArray(raw) ? raw : [];
        if (!items.length) break;
        allItems = allItems.concat(items);
        const rawTotal = raw?.total || raw?.totalResults || 0;
        if (items.length < batchSize || (rawTotal > 0 && allItems.length >= rawTotal)) break;
      }
      console.timeEnd("jetimob-fetch-for-reindex");
      console.log(`Fetched ${allItems.length} items from Jetimob`);

      // Drop and recreate collection
      await typesenseFetch(TYPESENSE_HOST, TYPESENSE_ADMIN_API_KEY, `/collections/${COLLECTION_NAME}`, { method: "DELETE" }).catch(() => {});
      await typesenseFetch(TYPESENSE_HOST, TYPESENSE_ADMIN_API_KEY, "/collections", {
        method: "POST",
        body: JSON.stringify(SCHEMA),
      });

      // Batch import using JSONL
      const BATCH_SIZE = 200;
      let indexed = 0;
      let errors = 0;
      for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
        const batch = allItems.slice(i, i + BATCH_SIZE);
        const docs = batch.map(mapImovelToDocument);
        const jsonl = docs.map(d => JSON.stringify(d)).join("\n");

        const resp = await fetch(`https://${TYPESENSE_HOST}/collections/${COLLECTION_NAME}/documents/import?action=upsert`, {
          method: "POST",
          headers: {
            "X-TYPESENSE-API-KEY": TYPESENSE_ADMIN_API_KEY,
            "Content-Type": "text/plain",
          },
          body: jsonl,
        });
        const resultText = await resp.text();
        const results = resultText.split("\n").filter(Boolean).map(l => JSON.parse(l));
        indexed += results.filter(r => r.success).length;
        errors += results.filter(r => !r.success).length;
      }

      console.log(`Typesense reindex: ${indexed} indexed, ${errors} errors out of ${allItems.length} total`);

      return new Response(JSON.stringify({
        success: true,
        total_fetched: allItems.length,
        indexed,
        errors,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ INDEX BATCH (upsert without dropping) ═══
    if (action === "index_batch") {
      const JETIMOB_API_KEY = Deno.env.get("JETIMOB_API_KEY");
      if (!JETIMOB_API_KEY) throw new Error("JETIMOB_API_KEY not configured");

      const pageNum = body.page || 1;
      const pageSize = body.pageSize || 200;
      const url = `https://api.jetimob.com/webservice/${JETIMOB_API_KEY}/imoveis/todos?v=6&page=${pageNum}&pageSize=${pageSize}`;
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Jetimob fetch failed: ${response.status}`);
      const raw = await response.json();
      const items = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.result) ? raw.result : Array.isArray(raw) ? raw : [];
      const total = raw?.total || raw?.totalResults || 0;

      if (items.length === 0) {
        return new Response(JSON.stringify({ success: true, indexed: 0, page: pageNum, total, done: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const docs = items.map(mapImovelToDocument);
      const jsonl = docs.map(d => JSON.stringify(d)).join("\n");
      const resp = await fetch(`https://${TYPESENSE_HOST}/collections/${COLLECTION_NAME}/documents/import?action=upsert`, {
        method: "POST",
        headers: { "X-TYPESENSE-API-KEY": TYPESENSE_ADMIN_API_KEY, "Content-Type": "text/plain" },
        body: jsonl,
      });
      const resultText = await resp.text();
      const results = resultText.split("\n").filter(Boolean).map(l => JSON.parse(l));
      const indexed = results.filter(r => r.success).length;
      const errors = results.filter(r => !r.success).length;
      const hasMore = items.length >= pageSize;

      return new Response(JSON.stringify({ success: true, indexed, errors, page: pageNum, total, hasMore }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ COLLECTION STATS ═══
    if (action === "stats") {
      const result = await typesenseFetch(TYPESENSE_HOST, TYPESENSE_ADMIN_API_KEY, `/collections/${COLLECTION_NAME}`);
      return new Response(JSON.stringify({ success: true, stats: result.data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("typesense-admin error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});