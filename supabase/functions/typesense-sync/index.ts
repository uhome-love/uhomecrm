import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const COLLECTION_NAME = "imoveis";

function mapImovelToDocument(item: any): Record<string, any> {
  const codigo = String(item.codigo || item.referencia || item.id_imovel || item.id || "");
  const fotos: string[] = [];
  if (item.foto_principal) fotos.push(item.foto_principal);
  if (item.foto_destaque && item.foto_destaque !== item.foto_principal) fotos.push(item.foto_destaque);
  const imgFieldNames = ["imagens", "fotos", "galeria", "photos", "images"];
  for (const fieldName of imgFieldNames) {
    const arr = item[fieldName];
    if (Array.isArray(arr)) {
      for (const it of arr) {
        const url = typeof it === "string" ? it : (it?.link_thumb || it?.link || it?.url || it?.arquivo || "");
        if (url && !fotos.includes(url)) fotos.push(url);
      }
    }
  }
  const situacao = String(item.situacao || item.status || item.fase || "").toLowerCase();
  const emObras = situacao.includes("obra") || situacao.includes("constru") || situacao.includes("planta") || situacao.includes("lancamento");

  return {
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
    foto_principal: fotos[0] || "",
    fotos: fotos.slice(0, 10),
    destaque: !!item.destaque,
    em_obras: emObras,
    previsao_entrega: item.previsao_entrega || item.data_entrega || "",
    valor_condominio: Number(item.valor_condominio || 0) || 0,
    is_uhome: String(item.codigo || "").toLowerCase().includes("-uh"),
    data_atualizacao: Date.now(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      // Done!
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

    // Index to Typesense
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

    // Update state
    await sb.from("typesense_sync_state").update({
      next_page: hasMore ? page + 1 : page,
      status: hasMore ? "running" : "complete",
      last_indexed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", "default");

    console.log(`Page ${page}: ${indexed} indexed, ${errors} errors, hasMore: ${hasMore}`);

    return new Response(JSON.stringify({ success: true, page, indexed, errors, hasMore }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("typesense-sync error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
