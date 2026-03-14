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

  const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  const L = {
    info: (msg: string, ctx?: Record<string, unknown>) => console.info(JSON.stringify({ fn: "whatsapp-notificacao", level: "info", msg, traceId, ctx, ts: new Date().toISOString() })),
    warn: (msg: string, ctx?: Record<string, unknown>) => console.warn(JSON.stringify({ fn: "whatsapp-notificacao", level: "warn", msg, traceId, ctx, ts: new Date().toISOString() })),
    error: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => console.error(JSON.stringify({ fn: "whatsapp-notificacao", level: "error", msg, traceId, ctx, err: err instanceof Error ? { name: err.name, message: err.message } : err ? { raw: String(err) } : undefined, ts: new Date().toISOString() })),
  };

  // Lazy supabase init for ops_events only
  const getSupabase = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
    try { getSupabase().from("ops_events").insert({ fn: "whatsapp-notificacao", level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(() => {}); } catch {}
  };

  try {
    const { telefone, tipo, dados } = await req.json();

    const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || Deno.env.get("WHATSAPP_TOKEN");
    const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || Deno.env.get("WHATSAPP_PHONE_ID");

    if (!token || !phoneId) {
      L.error("Credentials not configured", { hasToken: !!token, hasPhoneId: !!phoneId });
      logOps("error", "integration", "WhatsApp credentials not configured", { hasToken: !!token, hasPhoneId: !!phoneId });
      return new Response(
        JSON.stringify({ error: "WhatsApp credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const numeroLimpo = telefone.replace(/\D/g, "");
    const numeroFinal = numeroLimpo.startsWith("55") ? numeroLimpo : `55${numeroLimpo}`;

    L.info("Sending", { to: numeroFinal, tipo, leadNome: dados?.nome });

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
                { type: "text", text: dados.nome || "Lead" },
                { type: "text", text: dados.telefone || "N/A" },
                { type: "text", text: dados.email || "N/A" },
                { type: "text", text: dados.empreendimento || "Não identificado" },
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
      teste_texto: () => `🏠 Teste UhomeSales!\n\nSe você recebeu isso, a integração WhatsApp está funcionando. 🎉`,
    };

    let body: any;

    if (TEMPLATE_MESSAGES[tipo]) {
      body = TEMPLATE_MESSAGES[tipo]();
    } else if (TEXT_MESSAGES[tipo]) {
      const mensagem = TEXT_MESSAGES[tipo]();
      if (!mensagem) {
        L.warn("Empty message", { tipo });
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
      L.warn("Unknown message type", { tipo });
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

    if (response.ok) {
      L.info("Sent successfully", { tipo, to: numeroFinal, messageId: result?.messages?.[0]?.id });
    } else {
      L.error("API error", { tipo, to: numeroFinal, status: response.status, error: result?.error });
      logOps("error", "integration", `WhatsApp API error: ${response.status}`, { tipo, to: numeroFinal, status: response.status }, JSON.stringify(result?.error || {}));
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: response.ok ? 200 : 400,
    });
  } catch (err) {
    L.error("Unhandled exception", {}, err);
    logOps("error", "system", "Unhandled exception", {}, err instanceof Error ? err.message : String(err));
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
