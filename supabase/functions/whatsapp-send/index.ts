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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      const tplName = typeof template === 'string' ? template : template.name;
      const tplLang = typeof template === 'string' ? 'pt_BR' : (template.language || 'pt_BR');
      
      body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "template",
        template: {
          name: tplName,
          language: { code: tplLang },
        }
      };

      if (typeof template === "object" && template.parameters && typeof template.parameters === "object" && !Array.isArray(template.parameters)) {
        body.template.components = [
          {
            type: "body",
            parameters: Object.entries(template.parameters).map(([key, val]) => ({
              type: "text",
              parameter_name: key,
              text: String(val),
            })),
          },
        ];
      }

      if (typeof template === 'object' && template.components && template.components.length > 0) {
        body.template.components = template.components;
      }

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

    console.log("Sending WhatsApp to:", cleanPhone, "body:", JSON.stringify(body));

    const waResponse = await fetch(
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

    const waResult = await waResponse.json();

    if (!waResponse.ok) {
      console.error("WhatsApp API error:", JSON.stringify(waResult));
      const errorCode = waResult?.error?.code;
      const errorMsg = waResult?.error?.message || "Erro desconhecido";

      if (errorCode === 131047 || errorCode === 131026) {
        return new Response(
          JSON.stringify({
            error: "Fora da janela de 24h. Use template.",
            requires_template: true,
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro WhatsApp: " + errorMsg, details: waResult }),
        { status: waResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WhatsApp sent OK:", JSON.stringify(waResult));

    return new Response(
      JSON.stringify({
        success: true,
        message_id: waResult.messages?.[0]?.id,
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
