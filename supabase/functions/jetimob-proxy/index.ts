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
  return String(item.tipo || item.subtipo || item.tipo_imovel || "").toLowerCase();
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

      const data = await response.json();
      return new Response(JSON.stringify(data), {
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
      
      // Fetch larger batches when we need to filter locally, to ensure enough results
      const fetchSize = (search_uhome || hasLocalFilters) ? 500 : pageSize;
      const fetchPage = (search_uhome || hasLocalFilters) ? 1 : page;

      // Build URL — only pass params that Jetimob API reliably supports (contrato, cidade, search)
      let url = `https://api.jetimob.com/webservice/${JETIMOB_API_KEY}/imoveis/todos?v=6&page=${fetchPage}&pageSize=${fetchSize}`;
      if (contrato) url += `&contrato=${encodeURIComponent(contrato)}`;
      if (cidade) url += `&cidade=${encodeURIComponent(cidade)}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      console.log("Jetimob list_imoveis URL:", url, "| Filters:", JSON.stringify({ bairro, tipo, dormitorios, valor_min, valor_max, somente_obras }));

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
      
      // Normalize response format
      let items: any[] = Array.isArray(rawData) ? rawData 
        : (rawData?.result || rawData?.imoveis || rawData?.data || []);
      if (!Array.isArray(items)) items = [];
      
      const rawTotal = rawData?.total || rawData?.totalResults || rawData?.total_results || items.length;

      console.log("Jetimob raw items:", items.length, "rawTotal:", rawTotal);

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
