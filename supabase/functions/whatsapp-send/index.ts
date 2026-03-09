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
    const authHeader = req.headers.get("Authorization");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === supabaseServiceKey;
    console.log("Auth check - isServiceRole:", isServiceRole);

    const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      throw new Error("WhatsApp credentials not configured");
    }

    const { telefone, mensagem, nome, template } = await req.json();

    if (!telefone) {
      return new Response(
        JSON.stringify({ error: "telefone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let cleanPhone = telefone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.substring(1);
    if (!cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;

    let body;

    if (template) {
      body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language },
          components: template.components,
        },
      };
    } else if (mensagem) {
      body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: { body: mensagem },
      };
    } else {
      return new Response(
        JSON.stringify({ error: "mensagem ou template é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API error:", JSON.stringify(result));

      const errorCode = result?.error?.code;
      const errorMsg = result?.error?.message || "Erro desconhecido";

      if (errorCode === 131047 || errorCode === 131026) {
        return new Response(
          JSON.stringify({
            error: "Fora da janela de 24h. É necessário usar um template aprovado para iniciar conversa.",
            whatsapp_error: errorMsg,
            requires_template: true,
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Erro WhatsApp: ${errorMsg}`, details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WhatsApp message sent:", JSON.stringify(result));

    return new Response(
      JSON.stringify({
        success: true,
        message_id: result.messages?.[0]?.id,
        phone: cleanPhone,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("whatsapp-send error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
