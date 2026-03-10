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
      console.error("WHATSAPP_TOKEN or WHATSAPP_PHONE_ID not configured");
      return new Response(
        JSON.stringify({ error: "WhatsApp credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const numeroLimpo = telefone.replace(/\D/g, "");
    const numeroFinal = numeroLimpo.startsWith("55") ? numeroLimpo : `55${numeroLimpo}`;

    let mensagem = "";

    if (tipo === "novo_lead") {
      mensagem = `🔔 *NOVO LEAD — VOCÊ TEM 5 MINUTOS!*\n\n👤 *${dados.nome}*\n🏢 ${dados.empreendimento}\n📱 ${dados.telefone}\n\n⏱️ Acesse o UhomeSales agora e aceite antes que expire!\n👉 https://6e97ca96-8d59-451c-8ca6-c1b3d18c3c30.lovableproject.com/roleta-leads`;
    }

    if (tipo === "aviso_1h") {
      mensagem = `⚠️ *Lead sem contato há 1 hora!*\n\n👤 *${dados.nome}*\n🏢 ${dados.empreendimento}\n\nFaça a primeira interação agora no UhomeSales!`;
    }

    if (tipo === "aviso_1h30") {
      mensagem = `⚠️ *Segundo aviso — 1h30 sem contato!*\n\n👤 *${dados.nome}*\n🏢 ${dados.empreendimento}\n\nUrgente! Acesse o sistema agora.`;
    }

    if (tipo === "aviso_repasse") {
      mensagem = `🔴 *ÚLTIMO AVISO — Lead repassado em 30 min!*\n\n👤 *${dados.nome}*\n🏢 ${dados.empreendimento}\n\nApós 3 avisos o lead será repassado para outro corretor.`;
    }

    if (tipo === "lead_expirado_gestor") {
      mensagem = `📋 *Lead repassado por inatividade*\n\nCorretor: ${dados.corretor}\nLead: ${dados.nome} — ${dados.empreendimento}\n\nLead devolvido para a fila automaticamente.`;
    }

    if (tipo === "cobranca") {
      mensagem = dados.mensagem_personalizada || dados.mensagem || "";
    }

    if (!mensagem) {
      return new Response(
        JSON.stringify({ error: `Tipo de mensagem desconhecido: ${tipo}` }),
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