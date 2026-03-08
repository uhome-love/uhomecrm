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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { telefone, tipo, dados } = await req.json();

    // Use existing secrets (WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID)
    const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || Deno.env.get("WHATSAPP_TOKEN");
    const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || Deno.env.get("WHATSAPP_PHONE_ID");

    if (!token || !phoneId) {
      console.error("WhatsApp credentials not configured");
      return new Response(
        JSON.stringify({ error: "WhatsApp credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone: remove non-digits and ensure DDI 55
    const numeroLimpo = telefone.replace(/\D/g, "");
    const numeroFinal = numeroLimpo.startsWith("55") ? numeroLimpo : `55${numeroLimpo}`;

    if (numeroFinal.length < 12) {
      return new Response(
        JSON.stringify({ error: "Telefone inválido", telefone: numeroFinal }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let mensagem = "";

    if (tipo === "novo_lead") {
      mensagem =
        `🔔 *NOVO LEAD — VOCÊ TEM 5 MINUTOS!*\n\n` +
        `👤 *${dados.nome}*\n` +
        `🏢 ${dados.empreendimento}\n` +
        `📱 ${dados.telefone}\n\n` +
        `⏱️ Acesse o UhomeSales agora e aceite o lead antes que expire!\n` +
        `👉 https://uhomeia.lovable.app/roleta-leads`;
    }

    if (tipo === "aviso_interacao_1h") {
      mensagem =
        `⚠️ *ATENÇÃO — Lead sem contato há 1 hora!*\n\n` +
        `👤 *${dados.nome}*\n` +
        `🏢 ${dados.empreendimento}\n\n` +
        `Faça a primeira interação agora no UhomeSales para não perder o lead!`;
    }

    if (tipo === "aviso_interacao_1h30") {
      mensagem =
        `⚠️ *ATENÇÃO — Lead sem contato há 1h30!*\n\n` +
        `👤 *${dados.nome}*\n` +
        `🏢 ${dados.empreendimento}\n\n` +
        `Segundo aviso! Você ainda tem tempo. Acesse o sistema agora.`;
    }

    if (tipo === "aviso_repasse") {
      mensagem =
        `🔴 *ÚLTIMO AVISO — Lead será repassado em 30 minutos!*\n\n` +
        `👤 *${dados.nome}*\n` +
        `🏢 ${dados.empreendimento}\n\n` +
        `Após 3 avisos sem interação, o lead será repassado para outro corretor.`;
    }

    if (tipo === "lead_expirado_ceo") {
      mensagem =
        `📋 *Lead repassado por falta de interação*\n\n` +
        `Corretor: ${dados.corretor}\n` +
        `Lead: ${dados.nome} — ${dados.empreendimento}\n` +
        `Motivo: ${dados.motivo}\n\n` +
        `Lead devolvido para a fila.`;
    }

    if (!mensagem) {
      return new Response(
        JSON.stringify({ error: "Tipo de notificação desconhecido", tipo }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending WhatsApp to ${numeroFinal}, tipo: ${tipo}`);

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: numeroFinal,
          type: "text",
          text: { body: mensagem },
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API error:", JSON.stringify(result));
      return new Response(
        JSON.stringify({ error: "WhatsApp API error", details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WhatsApp sent successfully:", JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
