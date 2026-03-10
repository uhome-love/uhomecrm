import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
        // Return 200 with null data for not-found properties so the client handles gracefully
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

      // broker_id already extracted from body above

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
      
      // Filter by broker_id if provided (corretor filtering)
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
      const { page = 1, pageSize = 30, search, contrato, tipo, cidade, bairro } = body;
      let url = `https://api.jetimob.com/webservice/${JETIMOB_API_KEY}/imoveis/todos?v=6&page=${page}&pageSize=${pageSize}`;
      if (contrato) url += `&contrato=${encodeURIComponent(contrato)}`;
      if (tipo) url += `&tipo=${encodeURIComponent(tipo)}`;
      if (cidade) url += `&cidade=${encodeURIComponent(cidade)}`;
      if (bairro) url += `&bairro=${encodeURIComponent(bairro)}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const response = await fetch(url, { headers: { "Accept": "application/json" } });

      if (!response.ok) {
        const text = await response.text();
        console.error("Jetimob API error:", response.status, text);
        return new Response(
          JSON.stringify({ error: `Erro ao listar imóveis: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      // Log first item structure for debugging
      const items = data?.result || data?.imoveis || data?.data || [];
      if (Array.isArray(items) && items.length > 0) {
        console.log("Jetimob first imovel keys:", JSON.stringify(Object.keys(items[0])));
        console.log("Jetimob first imovel sample:", JSON.stringify(items[0]).substring(0, 1500));
      } else {
        console.log("Jetimob response keys:", JSON.stringify(Object.keys(data)));
        console.log("Jetimob response sample:", JSON.stringify(data).substring(0, 1000));
      }
      return new Response(JSON.stringify(data), {
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
