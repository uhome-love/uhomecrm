import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { pipeline_lead_id, segmento_id } = body;

    if (!pipeline_lead_id) {
      return new Response(JSON.stringify({ error: "pipeline_lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call the distribution function
    const { data, error } = await supabase.rpc("distribuir_lead_roleta", {
      p_pipeline_lead_id: pipeline_lead_id,
      p_segmento_id: segmento_id || null,
    });

    if (error) {
      console.error("Distribution error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If no corretor available, notify all gestores
    if (data && !data.success && data.reason === "no_corretor_available") {
      const { data: gestores } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["gestor", "admin"]);
      
      if (gestores) {
        for (const g of gestores) {
          await supabase.rpc("criar_notificacao", {
            p_user_id: g.user_id,
            p_tipo: "alertas",
            p_categoria: "lead_sem_atendimento",
            p_titulo: "⚠️ Lead sem corretor disponível",
            p_mensagem: `Nenhum corretor disponível para o segmento. Lead aguardando distribuição.`,
            p_dados: { pipeline_lead_id, segmento_id: data.segmento_id },
            p_agrupamento_key: "lead_sem_atendimento",
          });
        }
      }
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
