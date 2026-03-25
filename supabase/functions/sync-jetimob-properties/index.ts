import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PAGES_PER_CHUNK = 5;
const PAGE_SIZE = 100;
const BATCH_SIZE = 50;

// ── Type mapping ──
function mapTipo(raw: string | undefined): string {
  if (!raw) return "apartamento";
  const t = raw.toLowerCase().trim();
  if (t.includes("casa") || t.includes("sobrado")) return "casa";
  if (t.includes("cobertura")) return "cobertura";
  if (t.includes("studio") || t.includes("loft") || t.includes("kitnet") || t.includes("jk")) return "studio";
  if (t.includes("comercial") || t.includes("sala") || t.includes("loja") || t.includes("conjunto")) return "comercial";
  if (t.includes("terreno") || t.includes("lote")) return "terreno";
  return "apartamento";
}

function mapContrato(raw: string | undefined): string {
  if (!raw) return "venda";
  const c = raw.toLowerCase();
  if (c.includes("locacao") || c.includes("aluguel") || c.includes("locação")) return "locacao";
  return "venda";
}

function slugify(text: string): string {
  return text
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extractFotos(j: any): string[] {
  const sources = [j.imagens, j.fotos, j.galeria, j.photos];
  for (const src of sources) {
    if (Array.isArray(src) && src.length > 0) {
      return src.map((f: any) => {
        if (typeof f === "string") return f;
        return f?.link || f?.url || f?.link_thumb || f?.src || "";
      }).filter(Boolean);
    }
  }
  if (j.foto_principal) return [j.foto_principal];
  return [];
}

function extractFotosFull(j: any): string[] {
  const sources = [j.imagens, j.fotos, j.galeria, j.photos];
  for (const src of sources) {
    if (Array.isArray(src) && src.length > 0) {
      return src.map((f: any) => {
        if (typeof f === "string") return f;
        return f?.link_large || f?.link || f?.url || "";
      }).filter(Boolean);
    }
  }
  return [];
}

function extractDiferenciais(j: any): string[] {
  const result: string[] = [];
  const difs = j.diferenciais || j.imovel_comodidades || j.caracteristicas;
  if (Array.isArray(difs)) {
    for (const d of difs) {
      const name = typeof d === "string" ? d : d?.nome || d?.name;
      if (name) result.push(name.toLowerCase());
    }
  }
  return result;
}

function extractPreco(j: any): number | null {
  for (const k of ["valor_venda", "preco_venda", "valor", "preco", "price"]) {
    const v = Number(j[k]);
    if (v > 0) return v;
  }
  return null;
}

function mapImovel(j: any) {
  const codigo = String(j.codigo || j.id);
  const tipo = mapTipo(j.subtipo || j.tipo_imovel || j.tipo);
  const bairro = j.endereco_bairro || j.bairro || "";
  const titulo = j.titulo_anuncio || j.titulo || `${tipo} em ${bairro}`;
  const fotos = extractFotos(j);
  const fotosFull = extractFotosFull(j);

  return {
    jetimob_id: codigo,
    codigo: codigo,
    titulo: titulo,
    descricao: j.descricao_anuncio || j.descricao || null,
    tipo: tipo,
    finalidade: j.finalidade ? [mapContrato(j.finalidade)] : ["venda"],
    contrato: mapContrato(j.finalidade || j.operacao || j.contrato),
    situacao: j.situacao || null,
    endereco: j.endereco_logradouro || j.endereco || null,
    numero: j.endereco_numero || j.numero || null,
    bairro: bairro,
    cidade: j.endereco_cidade || j.cidade || "Porto Alegre",
    estado: j.endereco_estado || j.estado || "RS",
    cep: j.endereco_cep || j.cep || null,
    latitude: j.endereco_latitude || j.latitude || null,
    longitude: j.endereco_longitude || j.longitude || null,
    regiao: j.regiao || null,
    dormitorios: j.dormitorios || j.quartos || 0,
    suites: j.suites || 0,
    banheiros: j.banheiros || 0,
    vagas: j.garagens || j.vagas || 0,
    area_privativa: j.area_privativa || j.area_util || null,
    area_total: j.area_total || j.area_privativa || null,
    andar: j.andar || null,
    valor_venda: extractPreco(j),
    valor_locacao: j.valor_locacao ? Number(j.valor_locacao) : null,
    valor_condominio: j.valor_condominio ? Number(j.valor_condominio) : null,
    valor_iptu: j.valor_iptu || j.iptu ? Number(j.valor_iptu || j.iptu) : null,
    empreendimento: j.empreendimento_nome || j.empreendimento || null,
    construtora: j.construtora || null,
    is_uhome: j.is_uhome === true || j.is_uhome === 1,
    is_destaque: j.destaque === true || j.destaque === 1,
    is_exclusivo: j.exclusivo === true || j.exclusivo === 1,
    aceita_financiamento: j.financiavel ?? null,
    features: extractDiferenciais(j).length > 0 ? { diferenciais: extractDiferenciais(j) } : null,
    tags: Array.isArray(j.tags) ? j.tags : (typeof j.tags === "string" && j.tags ? j.tags.split(",").map((t: string) => t.trim()) : []),
    fotos: fotos,
    fotos_full: fotosFull,
    tour_virtual_url: j.tour_virtual_url || j.tour_360 || null,
    video_url: j.video_url || j.video || null,
    jetimob_raw: j,
    ativo: true,
    synced_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const JETIMOB_API_KEY = Deno.env.get("JETIMOB_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!JETIMOB_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required env vars");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const startPage = body.start_page || 1;
    const maxPages = Math.min(body.max_pages || PAGES_PER_CHUNK, PAGES_PER_CHUNK);
    const autoChain = body.auto_chain ?? false;

    let totalInserted = 0;
    let totalErrors = 0;
    let lastPage = startPage;
    let totalExpected = 0;
    let morePages = false;

    for (let i = 0; i < maxPages; i++) {
      const page = startPage + i;
      const url = `https://api.jetimob.com/webservice/${JETIMOB_API_KEY}/imoveis/todos?v=6&page=${page}&pageSize=${PAGE_SIZE}`;

      console.log(`[sync] Fetching page ${page}...`);
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`[sync] Jetimob API error page ${page}: ${resp.status}`);
        totalErrors++;
        break;
      }

      const data = await resp.json();
      const items = data?.data || data?.imoveis || data || [];
      
      if (!Array.isArray(items) || items.length === 0) {
        console.log(`[sync] No items on page ${page}, stopping`);
        break;
      }

      totalExpected = data?.total || data?.totalRegistros || 0;
      lastPage = page;

      // Map all items
      const mapped = items.map(mapImovel);

      // Upsert in batches
      for (let b = 0; b < mapped.length; b += BATCH_SIZE) {
        const batch = mapped.slice(b, b + BATCH_SIZE);
        const { error } = await supabase
          .from("properties")
          .upsert(batch, { onConflict: "jetimob_id" });

        if (error) {
          console.error(`[sync] Upsert error batch ${b}:`, error.message);
          totalErrors++;
        } else {
          totalInserted += batch.length;
        }
      }

      // Check if more pages
      if (items.length < PAGE_SIZE) break;
      morePages = true;
    }

    const nextStartPage = lastPage + 1;
    morePages = morePages && totalInserted > 0;

    // Auto-chain: trigger next chunk
    if (autoChain && morePages) {
      const selfUrl = `${SUPABASE_URL}/functions/v1/sync-jetimob-properties`;
      fetch(selfUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          start_page: nextStartPage,
          max_pages: PAGES_PER_CHUNK,
          auto_chain: true,
        }),
      }).catch((e) => console.error("[sync] Auto-chain error:", e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        inseridos: totalInserted,
        erros: totalErrors,
        total_esperado: totalExpected,
        last_page: lastPage,
        next_start_page: nextStartPage,
        more_pages: morePages,
        chained: autoChain && morePages,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[sync] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
