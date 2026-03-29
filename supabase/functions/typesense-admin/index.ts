import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    { name: "latitude", type: "float" as const, optional: true as const },
    { name: "longitude", type: "float" as const, optional: true as const },
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
  if (imovel.foto_principal) { thumbs.push(imovel.foto_principal); full.push(imovel.foto_principal); }
  if (imovel.foto_destaque && imovel.foto_destaque !== imovel.foto_principal) { thumbs.push(imovel.foto_destaque); full.push(imovel.foto_destaque); }
  const imgFieldNames = ["imagens", "fotos", "galeria", "photos", "images"];
  for (const fieldName of imgFieldNames) {
    const arr = imovel[fieldName];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item === "string") {
          if (!thumbs.includes(item)) thumbs.push(item);
          if (!full.includes(item)) full.push(item);
        } else if (item && typeof item === "object") {
          const thumb = item.link_thumb || item.link || item.url || item.arquivo || "";
          const fullUrl = item.link_large || item.link || item.link_medio || item.link_thumb || item.url || item.arquivo || "";
          if (thumb && !thumbs.includes(thumb)) thumbs.push(thumb);
          if (fullUrl && !full.includes(fullUrl)) full.push(fullUrl);
        }
      }
    }
  }
  return { thumbs, full };
}

// ── Map a row from 'properties' table directly to Typesense document ──
function mapPropertyToDocument(row: any): Record<string, any> {
  const codigo = String(row.codigo || "");
  const situacao = String(row.situacao || row.status_imovel || "").toLowerCase();
  const emObras = situacao.includes("obra") || situacao.includes("constru") || situacao.includes("planta") || situacao.includes("lancamento");

  const thumbs: string[] = Array.isArray(row.fotos) ? row.fotos : [];
  const fullPhotos: string[] = Array.isArray(row.fotos_full) ? row.fotos_full : thumbs;

  const lat = Number(row.latitude || 0);
  const lng = Number(row.longitude || 0);
  const hasCoords = lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng) && lat >= -35 && lat <= 5 && lng >= -75 && lng <= -30;

  const doc: Record<string, any> = {
    id: codigo || `auto_${Math.random().toString(36).slice(2)}`,
    codigo,
    titulo: row.titulo || "",
    descricao_resumida: (row.descricao || "").slice(0, 500),
    bairro: row.bairro || "",
    cidade: row.cidade || "Porto Alegre",
    endereco: [row.endereco || "", row.numero || ""].filter(Boolean).join(", "),
    empreendimento: row.empreendimento || row.condominio_nome || "",
    construtora: row.construtora || "",
    tipo: (row.tipo || "").toLowerCase(),
    categoria: "",
    contrato: row.contrato || "venda",
    valor_venda: Number(row.valor_venda || 0) || 0,
    valor_locacao: Number(row.valor_locacao || 0) || 0,
    area_privativa: Number(row.area_privativa || 0) || 0,
    area_total: Number(row.area_total || 0) || 0,
    dormitorios: Number(row.dormitorios || 0) || 0,
    suites: Number(row.suites || 0) || 0,
    banheiros: Number(row.banheiros || 0) || 0,
    vagas: Number(row.vagas || 0) || 0,
    status: row.status_imovel || "",
    situacao: situacao,
    foto_principal: thumbs[0] || "",
    fotos: thumbs.slice(0, 15),
    fotos_full: fullPhotos.slice(0, 15),
    destaque: !!row.is_destaque,
    em_obras: emObras,
    previsao_entrega: row.entrega_ano ? `${row.entrega_ano}${row.entrega_mes ? '-' + String(row.entrega_mes).padStart(2, '0') : ''}` : "",
    valor_condominio: Number(row.valor_condominio || 0) || 0,
    is_uhome: !!row.is_uhome || String(codigo).toLowerCase().includes("-uh"),
    data_atualizacao: Date.now(),
  };

  if (hasCoords) {
    doc.latitude = lat;
    doc.longitude = lng;
    doc.location = [lat, lng];
  }

  return doc;
}

// ── Legacy: Map Jetimob API item to Typesense document (kept for index_batch) ──
function mapImovelToDocument(item: any): Record<string, any> {
  const codigo = String(item.codigo || item.referencia || item.id_imovel || item.id || "");
  const { thumbs, full } = normalizeImages(item);
  const situacao = String(item.situacao || item.status || item.fase || "").toLowerCase();
  const emObras = situacao.includes("obra") || situacao.includes("constru") || situacao.includes("planta") || situacao.includes("lancamento");
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

  if (hasCoords) { doc.latitude = lat; doc.longitude = lng; doc.location = [lat, lng]; }
  return doc;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require authenticated user OR SYNC_SECRET header
    const syncSecret = Deno.env.get("SYNC_SECRET");
    const reqSecret = req.headers.get("x-sync-secret");
    const isSyncAuth = syncSecret && reqSecret === syncSecret;

    if (!isSyncAuth) {
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
    }

    const TYPESENSE_HOST = Deno.env.get("TYPESENSE_HOST");
    const TYPESENSE_ADMIN_API_KEY = Deno.env.get("TYPESENSE_ADMIN_API_KEY");
    if (!TYPESENSE_HOST || !TYPESENSE_ADMIN_API_KEY) {
      throw new Error("Typesense credentials not configured");
    }

    const body = await req.json();
    const { action } = body;
    const db = getSupabaseAdmin();

    // ═══ CREATE COLLECTION ═══
    if (action === "create_collection") {
      await typesenseFetch(TYPESENSE_HOST, TYPESENSE_ADMIN_API_KEY, `/collections/${COLLECTION_NAME}`, { method: "DELETE" }).catch(() => {});
      const result = await typesenseFetch(TYPESENSE_HOST, TYPESENSE_ADMIN_API_KEY, "/collections", {
        method: "POST",
        body: JSON.stringify(SCHEMA),
      });
      return new Response(JSON.stringify({ success: true, collection: result.data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ START REINDEX (from properties table — no Jetimob dependency) ═══
    if (action === "start_reindex") {
      // Ensure the collection exists
      const collCheck = await typesenseFetch(TYPESENSE_HOST, TYPESENSE_ADMIN_API_KEY, `/collections/${COLLECTION_NAME}`);
      if (collCheck.status === 404) {
        await typesenseFetch(TYPESENSE_HOST, TYPESENSE_ADMIN_API_KEY, "/collections", {
          method: "POST",
          body: JSON.stringify(SCHEMA),
        });
      }

      // Count active properties in the database
      const { count, error: countErr } = await db
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true);

      const totalItems = count || 0;
      const pageSize = 500;
      const totalPages = Math.ceil(totalItems / pageSize);

      // Reset sync state
      await db.from("typesense_sync_state").update({
        status: "running",
        next_page: 1,
        total_pages: totalPages,
        total_indexed: 0,
        total_errors: 0,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        finished_at: null,
        last_indexed_at: null,
      }).eq("id", "default");

      console.log(`[typesense-admin] Reindex started from DB: ${totalItems} properties, ${totalPages} pages`);

      return new Response(JSON.stringify({
        success: true,
        message: "Reindex iniciado em background (fonte: banco de dados)",
        total_items: totalItems,
        total_pages: totalPages,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ PROCESS NEXT BATCH (called by pg_cron — reads from properties table) ═══
    if (action === "process_next_batch") {
      const { data: state, error: stateErr } = await db
        .from("typesense_sync_state")
        .select("*")
        .eq("id", "default")
        .single();

      if (stateErr || !state) {
        return new Response(JSON.stringify({ success: false, error: "No sync state found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (state.status !== "running") {
        return new Response(JSON.stringify({ success: true, skipped: true, status: state.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const currentPage = state.next_page || 1;
      const pageSize = 500;
      const offset = (currentPage - 1) * pageSize;

      // Fetch from properties table (ordered by id for stable pagination)
      const { data: rows, error: fetchErr } = await db
        .from("properties")
        .select("codigo, titulo, descricao, tipo, contrato, situacao, status_imovel, endereco, numero, bairro, cidade, latitude, longitude, dormitorios, suites, banheiros, vagas, area_privativa, area_total, valor_venda, valor_locacao, valor_condominio, empreendimento, condominio_nome, construtora, is_uhome, is_destaque, fotos, fotos_full, entrega_ano, entrega_mes")
        .eq("ativo", true)
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (fetchErr) throw new Error(`DB fetch failed: ${fetchErr.message}`);

      const items = rows || [];
      let indexed = 0;
      let errors = 0;

      if (items.length > 0) {
        const docs = items.map(mapPropertyToDocument);
        const jsonl = docs.map(d => JSON.stringify(d)).join("\n");
        const resp = await fetch(`https://${TYPESENSE_HOST}/collections/${COLLECTION_NAME}/documents/import?action=upsert`, {
          method: "POST",
          headers: { "X-TYPESENSE-API-KEY": TYPESENSE_ADMIN_API_KEY, "Content-Type": "text/plain" },
          body: jsonl,
        });
        const resultText = await resp.text();
        const results = resultText.split("\n").filter(Boolean).map(l => JSON.parse(l));
        indexed = results.filter(r => r.success).length;
        errors = results.filter(r => !r.success).length;
      }

      const hasMore = items.length >= pageSize;
      const newTotalIndexed = (state.total_indexed || 0) + indexed;
      const newTotalErrors = (state.total_errors || 0) + errors;
      const now = new Date().toISOString();

      if (hasMore) {
        await db.from("typesense_sync_state").update({
          next_page: currentPage + 1,
          total_indexed: newTotalIndexed,
          total_errors: newTotalErrors,
          last_indexed_at: now,
          updated_at: now,
        }).eq("id", "default");
      } else {
        await db.from("typesense_sync_state").update({
          status: "complete",
          next_page: currentPage,
          total_indexed: newTotalIndexed,
          total_errors: newTotalErrors,
          last_indexed_at: now,
          updated_at: now,
          finished_at: now,
        }).eq("id", "default");
      }

      console.log(`[typesense-admin] Batch page=${currentPage}: ${indexed} indexed, ${errors} errors, hasMore=${hasMore} (source: DB)`);

      return new Response(JSON.stringify({
        success: true,
        page: currentPage,
        indexed,
        errors,
        total_indexed: newTotalIndexed,
        total_errors: newTotalErrors,
        hasMore,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ GET PROGRESS ═══
    if (action === "progress") {
      const { data: state } = await db
        .from("typesense_sync_state")
        .select("*")
        .eq("id", "default")
        .single();

      return new Response(JSON.stringify({ success: true, ...state }), {
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

    // ═══ TEST IMPORT: send 1 doc and return raw Typesense response ═══
    if (action === "test_import") {
      const { data: rows } = await db
        .from("properties")
        .select("codigo, titulo, descricao, tipo, contrato, situacao, status_imovel, endereco, numero, bairro, cidade, latitude, longitude, dormitorios, suites, banheiros, vagas, area_privativa, area_total, valor_venda, valor_locacao, valor_condominio, empreendimento, condominio_nome, construtora, is_uhome, is_destaque, fotos, fotos_full, entrega_ano, entrega_mes")
        .eq("ativo", true)
        .order("id", { ascending: true })
        .limit(3);

      const items = rows || [];
      if (items.length === 0) {
        return new Response(JSON.stringify({ error: "No active properties found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const docs = items.map(mapPropertyToDocument);
      const jsonl = docs.map(d => JSON.stringify(d)).join("\n");
      
      const resp = await fetch(`https://${TYPESENSE_HOST}/collections/${COLLECTION_NAME}/documents/import?action=upsert`, {
        method: "POST",
        headers: { "X-TYPESENSE-API-KEY": TYPESENSE_ADMIN_API_KEY, "Content-Type": "text/plain" },
        body: jsonl,
      });
      
      const resultText = await resp.text();
      
      return new Response(JSON.stringify({
        success: true,
        http_status: resp.status,
        docs_sent: docs.length,
        first_doc_sample: { id: docs[0].id, codigo: docs[0].codigo, tipo: docs[0].tipo, dormitorios: docs[0].dormitorios, data_atualizacao: docs[0].data_atualizacao },
        typesense_raw_response: resultText.slice(0, 2000),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ LEGACY: index_batch (kept for backward compat) ═══
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

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("typesense-admin error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
