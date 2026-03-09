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
    const { pipeline_lead_id, segmento_id, action } = body;

    // ─── Handle accept / reject ───
    if (action === "aceitar" || action === "rejeitar") {
      const rpcName = action === "aceitar" ? "aceitar_lead" : "rejeitar_lead";
      const params: any = {
        p_lead_id: pipeline_lead_id,
        p_corretor_id: user.id,
      };
      if (action === "aceitar") {
        params.p_status_inicial = body.status_inicial || "ligando_agora";
      }
      if (action === "rejeitar") {
        params.p_motivo = body.motivo || "outro";
      }

      const { data, error } = await supabase.rpc(rpcName, params);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Handle redistribution ───
    if (action === "redistribuir_pendentes") {
      const { data, error } = await supabase.rpc("redistribuir_leads_pendentes", {
        p_segmento_id: segmento_id || null,
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Distribute single lead (dispatch_fila_ceo or direct) ───
    if (!pipeline_lead_id) {
      return new Response(JSON.stringify({ error: "pipeline_lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve segmento from roleta_campanhas if not provided
    let resolvedSegmentoId = segmento_id || null;
    if (!resolvedSegmentoId) {
      const { data: lead } = await supabase
        .from("pipeline_leads")
        .select("empreendimento")
        .eq("id", pipeline_lead_id)
        .maybeSingle();

      if (lead?.empreendimento) {
        const { data: camp } = await supabase
          .from("roleta_campanhas")
          .select("segmento_id")
          .ilike("empreendimento", lead.empreendimento)
          .eq("ativo", true)
          .maybeSingle();
        if (camp) resolvedSegmentoId = camp.segmento_id;
      }
    }

    // Call the distribution RPC
    const { data, error } = await supabase.rpc("distribuir_lead_roleta", {
      p_pipeline_lead_id: pipeline_lead_id,
      p_segmento_id: resolvedSegmentoId,
    });

    if (error) {
      console.error("Distribution error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // After successful distribution, send WhatsApp notification
    if (data && data.success && data.corretor_id) {
      try {
        const { data: corretor } = await supabase
          .from("profiles")
          .select("telefone, nome")
          .eq("user_id", data.corretor_id)
          .maybeSingle();

        const { data: leadData } = await supabase
          .from("pipeline_leads")
          .select("nome, telefone, empreendimento")
          .eq("id", pipeline_lead_id)
          .maybeSingle();

        if (corretor?.telefone && leadData) {
          await fetch(`${supabaseUrl}/functions/v1/whatsapp-notificacao`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              telefone: corretor.telefone,
              tipo: "novo_lead",
              dados: {
                nome: leadData.nome || "Lead",
                empreendimento: leadData.empreendimento || "Não identificado",
                telefone: leadData.telefone || "",
              },
            }),
          });
          console.log(`WhatsApp notification sent to corretor ${corretor.nome}`);
        }
      } catch (whatsappErr) {
        console.error("WhatsApp notification error (non-blocking):", whatsappErr);
      }
    }

    // If no corretor available, notify gestores
    if (data && !data.success && (data.reason === "no_corretor_available" || data.reason === "fora_horario")) {
      try {
        const { data: gestores } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["gestor", "admin"]);

        if (gestores) {
          const msg = data.reason === "fora_horario"
            ? "Lead recebido fora do horário da roleta. Aguardando redistribuição."
            : "Nenhum corretor disponível para o segmento. Lead aguardando distribuição.";
          for (const g of gestores) {
            await supabase.rpc("criar_notificacao", {
              p_user_id: g.user_id,
              p_tipo: "alertas",
              p_categoria: "lead_sem_atendimento",
              p_titulo: "⚠️ Lead aguardando distribuição",
              p_mensagem: msg,
              p_dados: { pipeline_lead_id, segmento_id: data.segmento_id, reason: data.reason },
              p_agrupamento_key: "lead_sem_atendimento",
            });
          }
        }
      } catch (notifErr) {
        console.error("Notification error (non-blocking):", notifErr);
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
