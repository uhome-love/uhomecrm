import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const JETIMOB_API_KEY = Deno.env.get("JETIMOB_API_KEY");
    if (!JETIMOB_API_KEY) throw new Error("JETIMOB_API_KEY is not configured");

    const { action, codigo } = await req.json();

    if (action === "get_imovel") {
      const response = await fetch(
        `https://api.jetimob.com/webservice/${JETIMOB_API_KEY}/imoveis/codigo/${codigo}?v=6`,
        { headers: { "Accept": "application/json" } }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error("Jetimob API error:", response.status, text);
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

    if (action === "list_imoveis") {
      const response = await fetch(
        `https://api.jetimob.com/webservice/${JETIMOB_API_KEY}/imoveis/todos?v=6&page=1&pageSize=50`,
        { headers: { "Accept": "application/json" } }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error("Jetimob API error:", response.status, text);
        return new Response(
          JSON.stringify({ error: `Erro ao listar imóveis: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
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
