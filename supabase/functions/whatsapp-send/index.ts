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
    const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      throw new Error("WhatsApp credentials not configured");
    }

    const { telefone, mensagem, nome } = await req.json();

    if (!telefone || !mensagem) {
      return new Response(
        JSON.stringify({ error: "telefone e mensagem são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number: remove non-digits, ensure country code
    let cleanPhone = telefone.replace(/\D/g, "");
    // If starts with 0, remove it
    if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.substring(1);
    // If doesn't start with country code (55 for Brazil), add it
    if (!cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;

    // First, try sending a free-form text message (works within 24h window)
    const textResponse = await fetch(
      `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: { body: mensagem },
        }),
      }
    );

    const textResult = await textResponse.json();

    if (!textResponse.ok) {
      console.error("WhatsApp API error:", JSON.stringify(textResult));

      // If error is about template requirement (outside 24h window), inform user
      const errorCode = textResult?.error?.code;
      const errorMsg = textResult?.error?.message || "Erro desconhecido";

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
        JSON.stringify({ error: `Erro WhatsApp: ${errorMsg}`, details: textResult }),
        { status: textResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WhatsApp message sent:", JSON.stringify(textResult));

    return new Response(
      JSON.stringify({
        success: true,
        message_id: textResult.messages?.[0]?.id,
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
