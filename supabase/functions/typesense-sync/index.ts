import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COLLECTION_NAME = "imoveis";

// ── Crypto hash for change detection ──
async function hashPayload(payload: string): Promise<string> {
  const data = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Map Jetimob item to Typesense document ──
function mapImovelToDocument(item: any): Record<string, any> {
  const codigo = String(item.codigo || item.referencia || item.id_imovel || item.id || "");

  const thumbs: string[] = [];
  const full: string[] = [];
  if (item.foto_principal) { thumbs.push(item.foto_principal); full.push(item.foto_principal); }
  if (item.foto_destaque && item.foto_destaque !== item.foto_principal) { thumbs.push(item.foto_destaque); full.push(item.foto_destaque); }
  const imgFieldNames = ["imagens", "fotos", "galeria", "photos", "images"];
  for (const fieldName of imgFieldNames) {
    const arr = item[fieldName];
    if (Array.isArray(arr)) {
      for (const it of arr) {
        if (typeof it === "string") {
          if (!thumbs.includes(it)) thumbs.push(it);
          if (!full.includes(it)) full.push(it);
        } else if (it && typeof it === "object") {
          const thumb = it.link_thumb || it.link || it.url || it.arquivo || "";
          const fullUrl = it.link_large || it.link || it.link_medio || it.link_thumb || it.url || it.arquivo || "";
          if (thumb && !thumbs.includes(thumb)) thumbs.push(thumb);
          if (fullUrl && !full.includes(fullUrl)) full.push(fullUrl);
        }
      }
    }
  }

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

  if (hasCoords) {
    doc.latitude = lat;
    doc.longitude = lng;
    doc.location = [lat, lng];
  }

  return doc;
}

// ── Map Jetimob item to Supabase properties row ──
function mapImovelToProperty(item: any, thumbs: string[], fullPhotos: string[]) {
  const codigo = String(item.codigo || item.referencia || item.id_imovel || item.id || "");
  const situacao = String(item.situacao || item.status || item.fase || "").toLowerCase();
  const lat = Number(item.latitude || item.lat || item.endereco_latitude || item.endereco?.latitude || 0);
  const lng = Number(item.longitude || item.lng || item.lon || item.endereco_longitude || item.endereco?.longitude || 0);
  const hasCoords = lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng);

  return {
    jetimob_id: String(item.id_imovel || item.id || codigo),
    codigo,
    titulo: item.titulo_anuncio || item.empreendimento_nome || item.titulo || null,
    descricao: (item.descricao || item.descricao_interna || "").slice(0, 2000) || null,
    tipo: (item.subtipo || item.tipo_imovel || item.tipo || "").toLowerCase() || null,
    contrato: item.finalidade || item.contrato || "venda",
    situacao,
    endereco: [item.endereco_logradouro || item.endereco || "", item.endereco_numero || ""].filter(Boolean).join(", ") || null,
    numero: item.endereco_numero || null,
    bairro: item.endereco_bairro || item.bairro || item.endereco?.bairro || null,
    cidade: item.endereco_cidade || item.cidade || item.endereco?.cidade || "Porto Alegre",
    latitude: hasCoords ? lat : null,
    longitude: hasCoords ? lng : null,
    dormitorios: Number(item.dormitorios || item.quartos || 0) || null,
    suites: Number(item.suites || 0) || null,
    banheiros: Number(item.banheiros || 0) || null,
    vagas: Number(item.garagens || item.vagas || 0) || null,
    area_privativa: Number(item.area_privativa || item.area_util || 0) || null,
    area_total: Number(item.area_total || 0) || null,
    valor_venda: Number(item.valor_venda || item.preco_venda || item.valor || 0) || null,
    valor_locacao: Number(item.valor_locacao || item.preco_locacao || item.valor_aluguel || 0) || null,
    valor_condominio: Number(item.valor_condominio || 0) || null,
    empreendimento: item.empreendimento_nome || item.empreendimento || item.condominio || null,
    construtora: item.construtora || item.incorporadora || null,
    is_uhome: String(codigo).toLowerCase().includes("-uh"),
    is_destaque: !!item.destaque,
    fotos: thumbs.slice(0, 15),
    fotos_full: fullPhotos.slice(0, 15),
    ativo: true,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

  try {
    const TYPESENSE_HOST = Deno.env.get("TYPESENSE_HOST");
    const TYPESENSE_ADMIN_API_KEY = Deno.env.get("TYPESENSE_ADMIN_API_KEY");
    const JETIMOB_API_KEY = Deno.env.get("JETIMOB_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!TYPESENSE_HOST || !TYPESENSE_ADMIN_API_KEY || !JETIMOB_API_KEY) {
      throw new Error("Missing credentials");
    }

    const sb = createClient(supabaseUrl, serviceRoleKey);

    const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
      sb.from("ops_events").insert({ fn: "typesense-sync", level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
    };

    // ── Overlap guard ──
    const guardCutoff = new Date(Date.now() - 50_000).toISOString();
    const { data: recentRun } = await sb
      .from("ops_events")
      .select("id, trace_id")
      .eq("fn", "typesense-sync")
      .eq("category", "guard")
      .eq("message", "run_start")
      .gte("created_at", guardCutoff)
      .limit(1);

    if (recentRun && recentRun.length > 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "overlap_guard", recent_trace: recentRun[0].trace_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sb.from("ops_events").insert({
      fn: "typesense-sync", level: "info", category: "guard",
      message: "run_start", trace_id: traceId, ctx: {}, error_detail: null,
    });

    // Get current sync state
    const { data: state } = await sb
      .from("typesense_sync_state")
      .select("*")
      .eq("id", "default")
      .single();

    if (!state || state.status !== "running") {
      return new Response(JSON.stringify({ message: "Sync complete or not started" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const page = state.next_page;
    const pageSize = 500;

    console.log(`Syncing page ${page}...`);

    // Fetch from Jetimob
    const url = `https://api.jetimob.com/webservice/${JETIMOB_API_KEY}/imoveis/todos?v=6&page=${page}&pageSize=${pageSize}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Jetimob ${response.status}`);
    const raw = await response.json();
    const items = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.result) ? raw.result : Array.isArray(raw) ? raw : [];

    if (items.length === 0) {
      await sb.from("typesense_sync_state").update({
        status: "complete",
        last_indexed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", "default");

      console.log("Sync complete - no more items");
      return new Response(JSON.stringify({ message: "Sync complete", page }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Index to Typesense ──
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

    // ── Mirror to Supabase properties table ──
    let dbUpserted = 0;
    let dbPriceChanges = 0;
    try {
      const BATCH_SIZE = 50;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const codigos = batch.map((it: any) => String(it.codigo || it.referencia || it.id_imovel || it.id || "")).filter(Boolean);

        // Fetch existing properties to detect price changes
        const { data: existing } = await sb
          .from("properties")
          .select("codigo, valor_venda, valor_locacao, sync_hash")
          .in("codigo", codigos);

        const existingMap = new Map((existing || []).map(e => [e.codigo, e]));

        const rows: any[] = [];
        const priceChanges: any[] = [];

        for (const item of batch) {
          const doc = mapImovelToDocument(item);
          const thumbs = doc.fotos || [];
          const fullPhotos = doc.fotos_full || [];
          const propRow = mapImovelToProperty(item, thumbs, fullPhotos);

          // Compute hash for change detection
          const hashInput = JSON.stringify({
            titulo: propRow.titulo, valor_venda: propRow.valor_venda, valor_locacao: propRow.valor_locacao,
            bairro: propRow.bairro, dormitorios: propRow.dormitorios, area_privativa: propRow.area_privativa,
            situacao: propRow.situacao, empreendimento: propRow.empreendimento,
          });
          const hash = await hashPayload(hashInput);
          (propRow as any).sync_hash = hash;

          // Detect price changes
          const prev = existingMap.get(propRow.codigo);
          if (prev) {
            const prevVenda = Number(prev.valor_venda || 0);
            const newVenda = Number(propRow.valor_venda || 0);
            if (prevVenda > 0 && newVenda > 0 && prevVenda !== newVenda) {
              const variacao = ((newVenda - prevVenda) / prevVenda) * 100;
              priceChanges.push({
                property_id: null, // Will resolve after upsert
                property_code: propRow.codigo,
                campo: "valor_venda",
                valor_anterior: prevVenda,
                valor_novo: newVenda,
                variacao_pct: Math.round(variacao * 100) / 100,
              });
            }
            const prevLoc = Number(prev.valor_locacao || 0);
            const newLoc = Number(propRow.valor_locacao || 0);
            if (prevLoc > 0 && newLoc > 0 && prevLoc !== newLoc) {
              const variacao = ((newLoc - prevLoc) / prevLoc) * 100;
              priceChanges.push({
                property_id: null,
                property_code: propRow.codigo,
                campo: "valor_locacao",
                valor_anterior: prevLoc,
                valor_novo: newLoc,
                variacao_pct: Math.round(variacao * 100) / 100,
              });
            }
          }

          rows.push(propRow);
        }

        // Upsert properties
        const { error: upsertErr } = await sb
          .from("properties")
          .upsert(rows, { onConflict: "codigo" });

        if (upsertErr) {
          console.warn(`Properties upsert error (batch ${i}):`, upsertErr.message);
        } else {
          dbUpserted += rows.length;
        }

        // Insert price changes (resolve property_id)
        if (priceChanges.length > 0) {
          const changeCodes = priceChanges.map(pc => pc.property_code);
          const { data: propIds } = await sb
            .from("properties")
            .select("id, codigo")
            .in("codigo", changeCodes);

          const idMap = new Map((propIds || []).map(p => [p.codigo, p.id]));
          const priceRows = priceChanges
            .map(pc => ({ property_id: idMap.get(pc.property_code), campo: pc.campo, valor_anterior: pc.valor_anterior, valor_novo: pc.valor_novo, variacao_pct: pc.variacao_pct }))
            .filter(pr => pr.property_id);

          if (priceRows.length > 0) {
            await sb.from("property_price_history").insert(priceRows);
            dbPriceChanges += priceRows.length;
          }
        }
      }
    } catch (dbErr) {
      console.warn("Properties mirror error (non-fatal):", dbErr);
      logOps("warn", "business", "Properties mirror error (non-fatal)", { page, error: dbErr instanceof Error ? dbErr.message : String(dbErr) });
    }

    // Update sync state
    await sb.from("typesense_sync_state").update({
      next_page: hasMore ? page + 1 : page,
      status: hasMore ? "running" : "complete",
      last_indexed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", "default");

    console.info(JSON.stringify({
      fn: "typesense-sync", level: "info", traceId,
      msg: `Page ${page}: ${indexed} indexed, ${errors} errors, ${dbUpserted} mirrored, ${dbPriceChanges} price changes, hasMore: ${hasMore}`,
      ts: new Date().toISOString(),
    }));

    if (errors > 0) {
      logOps("warn", "business", `Typesense sync page ${page} had ${errors} indexing errors`, { page, indexed, errors, hasMore });
    }

    return new Response(JSON.stringify({ success: true, page, indexed, errors, dbUpserted, dbPriceChanges, hasMore }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(JSON.stringify({ fn: "typesense-sync", level: "error", msg: "Unhandled exception", traceId, err: e instanceof Error ? { name: e.name, message: e.message } : { raw: String(e) }, ts: new Date().toISOString() }));
    try {
      const sbErr = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      sbErr.from("ops_events").insert({ fn: "typesense-sync", level: "error", category: "system", message: "Unhandled exception", trace_id: traceId, ctx: {}, error_detail: e instanceof Error ? e.message : String(e) }).then(() => {});
    } catch {}
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
