// Sync diário do catálogo Jetimob → tabela imoveis_catalog
// Trigger: cron 04:00 BRT (07:00 UTC) ou manual
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalize(s: string): string {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
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

function normalizeImages(imovel: any): { thumbs: string[]; full: string[] } {
  const thumbs: string[] = [];
  const full: string[] = [];
  if (imovel.foto_principal) { thumbs.push(imovel.foto_principal); full.push(imovel.foto_principal); }
  if (imovel.foto_destaque && imovel.foto_destaque !== imovel.foto_principal) {
    thumbs.push(imovel.foto_destaque); full.push(imovel.foto_destaque);
  }
  const fields = ["imagens", "fotos", "galeria", "photos", "images", "fotos_imovel", "galeria_fotos", "midia", "midias"];
  for (const f of fields) {
    const arr = imovel[f];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (typeof item === "string") {
        if (item && !thumbs.includes(item)) thumbs.push(item);
        if (item && !full.includes(item)) full.push(item);
      } else if (item && typeof item === "object") {
        const t = item.link_thumb || item.link || item.url || item.arquivo || item.src || item.path || item.foto || item.imagem || "";
        const fl = item.link_large || item.link || item.link_medio || item.link_thumb || item.url || item.arquivo || item.src || "";
        if (t && !thumbs.includes(t)) thumbs.push(t);
        if (fl && !full.includes(fl)) full.push(fl);
      }
    }
  }
  return { thumbs, full };
}

async function fetchAllJetimob(apiKey: string): Promise<any[]> {
  const batchSize = 500;
  const maxPages = 60;
  let allItems: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://api.jetimob.com/webservice/${apiKey}/imoveis/todos?v=6&page=${page}&pageSize=${batchSize}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      console.warn(`Page ${page} failed: ${response.status}`);
      break;
    }
    const raw = await response.json();
    const items = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.result) ? raw.result : Array.isArray(raw) ? raw : [];
    if (!items.length) break;
    allItems = allItems.concat(items);
    const rawTotal = raw?.total || raw?.totalResults || raw?.total_results || 0;
    if (items.length < batchSize || (rawTotal > 0 && allItems.length >= rawTotal)) break;
  }
  return allItems;
}

function buildRow(item: any): any {
  const codigo = String(item.codigo || item.referencia || item.id_imovel || item.id || "").trim();
  if (!codigo) return null;
  const titulo = String(item.titulo_anuncio || item.titulo || "");
  const empreendimento = String(item.empreendimento_nome || item.empreendimento || item.condominio || "");
  const bairro = String(item.endereco_bairro || item.bairro || item.endereco?.bairro || "");
  const tipo = String(item.subtipo || item.tipo_imovel || item.tipo || "").toLowerCase();
  const endereco = String(item.endereco_logradouro || item.endereco?.logradouro || item.endereco_completo || "");
  const valor_venda = Number(item.valor_venda || item.preco_venda || 0) || null;
  const valor_locacao = Number(item.valor_locacao || item.preco_locacao || item.valor_aluguel || 0) || null;
  const dormitorios = Number(item.dormitorios || item.quartos || item.dorms || 0) || null;
  const suites = Number(item.suites || 0) || null;
  const vagas = Number(item.garagens || item.vagas || 0) || null;
  const area = Number(item.area_privativa || item.area_util || item.area_total || 0) || null;
  const situacao = String(item.situacao || item.status || item.fase || "");
  const codigoLower = codigo.toLowerCase();
  const is_uhome = codigoLower.includes("-uh");
  const contrato = valor_venda && valor_venda > 0 ? "venda" : (valor_locacao && valor_locacao > 0 ? "locacao" : null);
  const imgs = normalizeImages(item);
  const search_text = `${normalize(titulo)} ${normalize(bairro)} ${normalize(empreendimento)} ${normalize(endereco)} ${codigoLower}`;
  return {
    codigo,
    payload: item,
    titulo: titulo || null,
    empreendimento: empreendimento || null,
    bairro: bairro || null,
    tipo: tipo || null,
    contrato,
    valor_venda,
    valor_locacao,
    dormitorios,
    suites,
    vagas,
    area,
    situacao: situacao || null,
    is_uhome,
    search_text,
    fotos_thumbs: imgs.thumbs,
    fotos_full: imgs.full,
    synced_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = new Date();
  const t0 = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const JETIMOB_API_KEY = Deno.env.get("JETIMOB_API_KEY");
    if (!JETIMOB_API_KEY) throw new Error("JETIMOB_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Marca início
    await supabase.from("imoveis_catalog_sync_status").update({
      ultimo_sync_iniciado_em: startedAt.toISOString(),
      ultimo_sync_status: "running",
      ultimo_sync_erro: null,
    }).eq("id", 1);

    console.log("[jetimob-sync-catalog] Buscando catálogo da API Jetimob...");
    const items = await fetchAllJetimob(JETIMOB_API_KEY);
    console.log(`[jetimob-sync-catalog] Recebidos ${items.length} imóveis da Jetimob`);

    // Monta rows válidas
    const rows = items.map(buildRow).filter(Boolean);
    const codigosVivos = new Set(rows.map((r: any) => r.codigo));

    // Upsert em batches de 500
    const batchSize = 500;
    let upserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from("imoveis_catalog").upsert(batch, { onConflict: "codigo" });
      if (error) throw new Error(`Upsert batch ${i} falhou: ${error.message}`);
      upserted += batch.length;
    }

    // Remove imóveis que sumiram da Jetimob (deletados/inativos)
    const { data: existentes } = await supabase.from("imoveis_catalog").select("codigo");
    const paraRemover = (existentes || [])
      .map((r: any) => r.codigo)
      .filter((c: string) => !codigosVivos.has(c));

    let removidos = 0;
    if (paraRemover.length > 0) {
      // Remove em batches de 500
      for (let i = 0; i < paraRemover.length; i += batchSize) {
        const batch = paraRemover.slice(i, i + batchSize);
        const { error } = await supabase.from("imoveis_catalog").delete().in("codigo", batch);
        if (error) console.warn(`Erro ao remover batch ${i}: ${error.message}`);
        else removidos += batch.length;
      }
    }

    const duracao = Date.now() - t0;
    await supabase.from("imoveis_catalog_sync_status").update({
      ultimo_sync_concluido_em: new Date().toISOString(),
      ultimo_sync_status: "success",
      ultimo_sync_total: upserted,
      duracao_ms: duracao,
    }).eq("id", 1);

    console.log(`[jetimob-sync-catalog] OK: upserted=${upserted}, removidos=${removidos}, duracao=${duracao}ms`);

    return new Response(JSON.stringify({
      success: true,
      total_recebidos: items.length,
      upserted,
      removidos,
      duracao_ms: duracao,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[jetimob-sync-catalog] FAIL:", msg);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);
      await supabase.from("imoveis_catalog_sync_status").update({
        ultimo_sync_concluido_em: new Date().toISOString(),
        ultimo_sync_status: "error",
        ultimo_sync_erro: msg,
        duracao_ms: Date.now() - t0,
      }).eq("id", 1);
    } catch (_) { /* ignore */ }
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
