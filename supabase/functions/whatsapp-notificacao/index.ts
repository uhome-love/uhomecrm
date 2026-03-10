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
    const { telefone, tipo, dados } = await req.json();

    const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || Deno.env.get("WHATSAPP_TOKEN");
    const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || Deno.env.get("WHATSAPP_PHONE_ID");

    if (!token || !phoneId) {
      console.error("WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured");
      return new Response(
        JSON.stringify({ error: "WhatsApp credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const numeroLimpo = telefone.replace(/\D/g, "");
    const numeroFinal = numeroLimpo.startsWith("55") ? numeroLimpo : `55${numeroLimpo}`;

    console.log(`Sending WhatsApp to ${numeroFinal}, tipo: ${tipo}`);

    // Template-based messages
    const TEMPLATE_MESSAGES: Record<string, () => any> = {
      novo_lead: () => ({
        messaging_product: "whatsapp",
        to: numeroFinal,
        type: "template",
        template: {
          name: "novo_lead",
          language: { code: "pt_BR" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", parameter_name: "nome", text: dados.nome || "Lead" },
                { type: "text", parameter_name: "whatsapp_lead", text: dados.telefone || "N/A" },
                { type: "text", parameter_name: "email", text: dados.email || "N/A" },
                { type: "text", parameter_name: "empreendimento", text: dados.empreendimento || "Não identificado" },
              ],
            },
          ],
        },
      }),
    };

    // Fallback text messages for types without templates
    const TEXT_MESSAGES: Record<string, () => string> = {
      aviso_1h: () => `⚠️ *Lead sem contato há 1 hora!*\n\n👤 *${dados.nome}*\n🏢 ${dados.empreendimento}\n\nFaça a primeira interação agora no UhomeSales!`,
      aviso_1h30: () => `⚠️ *Segundo aviso — 1h30 sem contato!*\n\n👤 *${dados.nome}*\n🏢 ${dados.empreendimento}\n\nUrgente! Acesse o sistema agora.`,
      aviso_repasse: () => `🔴 *ÚLTIMO AVISO — Lead repassado em 30 min!*\n\n👤 *${dados.nome}*\n🏢 ${dados.empreendimento}\n\nApós 3 avisos o lead será repassado para outro corretor.`,
      lead_expirado_gestor: () => `📋 *Lead repassado por inatividade*\n\nCorretor: ${dados.corretor}\nLead: ${dados.nome} — ${dados.empreendimento}\n\nLead devolvido para a fila automaticamente.`,
      cobranca: () => dados.mensagem_personalizada || dados.mensagem || "",
    };

    let body: any;

    if (TEMPLATE_MESSAGES[tipo]) {
      // Use approved template
      body = TEMPLATE_MESSAGES[tipo]();
    } else if (TEXT_MESSAGES[tipo]) {
      // Fallback to text (only works within 24h window)
      const mensagem = TEXT_MESSAGES[tipo]();
      if (!mensagem) {
        return new Response(
          JSON.stringify({ error: `Mensagem vazia para tipo: ${tipo}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      body = {
        messaging_product: "whatsapp",
        to: numeroFinal,
        type: "text",
        text: { body: mensagem },
      };
    } else {
      return new Response(
        JSON.stringify({ error: `Tipo de mensagem desconhecido: ${tipo}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const result = await response.json();
    console.log("WhatsApp response:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: response.ok ? 200 : 400,
    });
  } catch (err) {
    console.error("whatsapp-notificacao error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});