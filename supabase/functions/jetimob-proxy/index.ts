import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Helpers for server-side filtering ───
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
  const v = item.dormitorios || item.quartos || item.dorms || item.suites || 0;
  return Number(v) || 0;
}

function getBairro(item: any): string {
  return String(item.endereco_bairro || item.bairro || "");
}

function getTipo(item: any): string {
  // Prefer subtipo (e.g. "Apartamento") over tipo (e.g. "Residencial") for more specific matching
  return String(item.subtipo || item.tipo_imovel || item.tipo || "").toLowerCase();
}

/** Extract and normalize all image URLs from a Jetimob imovel object */
function normalizeImages(imovel: any, logCodigo?: string): string[] {
  const fotos: string[] = [];
  if (imovel.foto_principal) fotos.push(imovel.foto_principal);
  if (imovel.foto_destaque && imovel.foto_destaque !== imovel.foto_principal) fotos.push(imovel.foto_destaque);
  
  const imgFieldNames = ["imagens", "fotos", "galeria", "photos", "images", "fotos_imovel", "galeria_fotos", "midia", "midias"];
  for (const fieldName of imgFieldNames) {
    const arr = imovel[fieldName];
    if (Array.isArray(arr) && arr.length > 0) {
      if (logCodigo) console.log(`Jetimob ${logCodigo} image field "${fieldName}": ${arr.length} items, sample:`, JSON.stringify(arr[0]).substring(0, 300));
      for (const item of arr) {
        if (typeof item === "string") {
          if (item && !fotos.includes(item)) fotos.push(item);
        } else if (item && typeof item === "object") {
          const url = item.link || item.link_thumb || item.url || item.arquivo || item.src || item.path || item.foto || item.imagem || "";
          if (url && !fotos.includes(url)) fotos.push(url);
        }
      }
    }
  }
  return fotos;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- JWT Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const JETIMOB_API_KEY = Deno.env.get("JETIMOB_API_KEY");
    if (!JETIMOB_API_KEY) throw new Error("JETIMOB_API_KEY is not configured");

    const body = await req.json();
    const { action, codigo, broker_id } = body;

    if (action === "get_imovel") {
      const response = await fetch(
        `https://api.jetimob.com/webservice/${JETIMOB_API_KEY}/imoveis/codigo/${codigo}?v=6`,
        { headers: { "Accept": "application/json" } }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error("Jetimob API error:", response.status, text);
        if (response.status === 404) {
          return new Response(
            JSON.stringify({ data: null, not_found: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: `Erro ao buscar imóvel: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const raw = await response.json();
      console.log("Jetimob get_imovel raw keys:", JSON.stringify(Object.keys(raw)), "codigo:", codigo);

      // Normalize: extract the actual property object from various response formats
      let imovel: any = null;
      if (Array.isArray(raw?.data) && raw.data.length > 0) {
        imovel = raw.data[0];
      } else if (raw?.imovel) {
        imovel = raw.imovel;
      } else if (raw?.codigo) {
        imovel = raw;
      }

      if (imovel) {
        // Log ALL keys for debugging image issues
        console.log("Jetimob imovel keys:", codigo, JSON.stringify(Object.keys(imovel)));
        
        const fotos = normalizeImages(imovel, codigo);
        imovel._fotos_normalized = fotos;
        console.log("Jetimob imovel normalized:", codigo, "fotos:", fotos.length);
      }

      return new Response(JSON.stringify({ imovel, not_found: !imovel }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_leads") {
      const JETIMOB_LEADS_URL_KEY = Deno.env.get("JETIMOB_LEADS_URL_KEY");
      if (!JETIMOB_LEADS_URL_KEY) throw new Error("JETIMOB_LEADS_URL_KEY is not configured");

      const url = `https://api.jetimob.com/leads/${JETIMOB_LEADS_URL_KEY}`;
      const JETIMOB_LEADS_PRIVATE_KEY = Deno.env.get("JETIMOB_LEADS_PRIVATE_KEY");
      if (!JETIMOB_LEADS_PRIVATE_KEY) throw new Error("JETIMOB_LEADS_PRIVATE_KEY is not configured");

      const response = await fetch(url, {
        method: "GET",
        headers: { 
          "Authorization-Key": JETIMOB_LEADS_PRIVATE_KEY,
        },
      });

      const text = await response.text();
      console.log("Jetimob Leads response status:", response.status, "body:", text.substring(0, 500));

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `Erro ao buscar leads: ${response.status}`, details: text }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let data = JSON.parse(text);
      
      if (broker_id) {
        const results = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];
        const filtered = results.filter((lead: any) => {
          const responsavelId = lead.broker_id || lead.responsavel_id || lead.user_id;
          return String(responsavelId) === String(broker_id);
        });
        data = { result: filtered };
        console.log(`Filtered leads for broker ${broker_id}: ${filtered.length} of ${results.length}`);
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_imoveis") {
      const { page = 1, pageSize = 20, search, contrato, tipo, cidade, bairro, dormitorios, valor_min, valor_max, search_uhome, somente_obras } = body;

      // Determine if we have active filters that require client-side post-filtering
      const hasLocalFilters = !!(bairro || valor_min || valor_max || dormitorios || tipo || somente_obras);
      
      // Build base URL
      const baseParams = new URLSearchParams({ v: "6" });
      if (contrato) baseParams.set("contrato", contrato);
      if (cidade) baseParams.set("cidade", cidade);
      if (search) baseParams.set("search", search);
      // Pass bairro as search term to narrow API results when no free-text search
      if (bairro && !search) baseParams.set("search", bairro);

      let allItems: any[] = [];

      if (search_uhome || hasLocalFilters) {
        // Fetch multiple pages to have enough data for local filtering
        const batchSize = 500;
        const maxPages = 4; // Up to 2000 items
        
        for (let p = 1; p <= maxPages; p++) {
          const url = `https://api.jetimob.com/webservice/${JETIMOB_API_KEY}/imoveis/todos?${baseParams.toString()}&page=${p}&pageSize=${batchSize}`;
          if (p === 1) console.log("Jetimob list_imoveis URL:", url, "| Filters:", JSON.stringify({ bairro, tipo, dormitorios, valor_min, valor_max, somente_obras }));
          
          const response = await fetch(url, { headers: { "Accept": "application/json" } });
          if (!response.ok) {
            if (p === 1) {
              const text = await response.text();
              console.error("Jetimob API error:", response.status, text);
              return new Response(
                JSON.stringify({ error: `Erro ao listar imóveis: ${response.status}` }),
                { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            break; // Stop paginating on error for subsequent pages
          }
          
          const rawData = await response.json();
          let items: any[] = Array.isArray(rawData) ? rawData 
            : (rawData?.result || rawData?.imoveis || rawData?.data || []);
          if (!Array.isArray(items)) items = [];
          
          allItems = allItems.concat(items);
          console.log(`Jetimob page ${p}: ${items.length} items, total so far: ${allItems.length}`);
          
          // Stop if we got fewer items than requested (last page)
          const rawTotal = rawData?.total || rawData?.totalResults || rawData?.total_results || 0;
          if (items.length < batchSize || (rawTotal > 0 && allItems.length >= rawTotal)) break;
        }
      } else {
        // Simple pagination — no local filters, pass through to API
        const url = `https://api.jetimob.com/webservice/${JETIMOB_API_KEY}/imoveis/todos?${baseParams.toString()}&page=${page}&pageSize=${pageSize}`;
        console.log("Jetimob list_imoveis URL:", url);
        
        const response = await fetch(url, { headers: { "Accept": "application/json" } });
        if (!response.ok) {
          const text = await response.text();
          console.error("Jetimob API error:", response.status, text);
          return new Response(
            JSON.stringify({ error: `Erro ao listar imóveis: ${response.status}` }),
            { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const rawData = await response.json();
        let items: any[] = Array.isArray(rawData) ? rawData 
          : (rawData?.result || rawData?.imoveis || rawData?.data || []);
        if (!Array.isArray(items)) items = [];
        allItems = items;
        
        // For non-filtered requests, return API pagination directly
        const rawTotal = rawData?.total || rawData?.totalResults || rawData?.total_results || items.length;
        console.log("Jetimob raw items:", items.length, "rawTotal:", rawTotal);
        // Log first item keys for debugging
        if (items.length > 0) console.log("Jetimob list first item keys:", JSON.stringify(Object.keys(items[0])).substring(0, 400));
        // Normalize images on each item
        for (const item of items) {
          item._fotos_normalized = normalizeImages(item);
        }
        
        return new Response(JSON.stringify({ 
          data: items, 
          total: rawTotal, 
          totalPages: Math.ceil(rawTotal / pageSize) || 1 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let items = allItems;
      console.log("Jetimob total fetched for filtering:", items.length);

      // ─── Apply server-side post-filters ───

      // uHome filter
      if (search_uhome) {
        items = items.filter((item: any) => {
          const cod = String(item.codigo || "").toUpperCase();
          return cod.includes("-UH");
        });
      }

      // Bairro filter (fuzzy match, accent-insensitive)
      if (bairro) {
        const bairroNorm = normalize(bairro);
        items = items.filter((item: any) => {
          const b = normalize(getBairro(item));
          return b.includes(bairroNorm) || bairroNorm.includes(b);
        });
        console.log(`After bairro filter "${bairro}":`, items.length);
      }

      // Tipo filter
      if (tipo && tipo !== "all") {
        const tipoNorm = normalize(tipo);
        items = items.filter((item: any) => {
          const t = normalize(getTipo(item));
          return t.includes(tipoNorm) || tipoNorm.includes(t);
        });
        console.log(`After tipo filter "${tipo}":`, items.length);
      }

      // Dormitórios filter (minimum)
      if (dormitorios && dormitorios !== "all") {
        const minDorms = Number(dormitorios);
        if (minDorms > 0) {
          items = items.filter((item: any) => getDorms(item) >= minDorms);
          console.log(`After dormitorios filter >=${minDorms}:`, items.length);
        }
      }

      // Valor mínimo
      if (valor_min) {
        const min = Number(valor_min);
        if (min > 0) {
          items = items.filter((item: any) => {
            const price = getPrice(item, contrato);
            return price >= min;
          });
          console.log(`After valor_min filter >=${min}:`, items.length);
        }
      }

      // Valor máximo
      if (valor_max) {
        const max = Number(valor_max);
        if (max > 0) {
          items = items.filter((item: any) => {
            const price = getPrice(item, contrato);
            return price > 0 && price <= max;
          });
          console.log(`After valor_max filter <=${max}:`, items.length);
        }
      }

      // Somente em obras / na planta
      if (somente_obras) {
        items = items.filter((item: any) => {
          const situacao = normalize(item.situacao || item.status || item.fase || "");
          return situacao.includes("obra") || situacao.includes("constru") || situacao.includes("planta") || situacao.includes("lancamento");
        });
        console.log(`After somente_obras filter:`, items.length);
      }

      // ─── Pagination on filtered results ───
      const totalFiltered = items.length;
      const totalPagesCalc = Math.ceil(totalFiltered / pageSize) || 1;
      const start = (page - 1) * pageSize;
      const paginatedItems = items.slice(start, start + pageSize);

      console.log(`Returning page ${page}: ${paginatedItems.length} items of ${totalFiltered} filtered`);
      // Normalize images on paginated results
      for (const item of paginatedItems) {
        item._fotos_normalized = normalizeImages(item);
      }

      return new Response(JSON.stringify({ 
        data: paginatedItems, 
        total: totalFiltered, 
        totalPages: totalPagesCalc 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("jetimob-proxy error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
