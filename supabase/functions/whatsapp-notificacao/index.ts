import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // Aviso interno para corretores: SOMENTE canais Meta (template + texto livre).
  // Nunca usar a instância Evolution de nutrição — aquele número fala com clientes.




  try {
    const { telefone, tipo, dados } = await req.json();

    // --- Guard híbrido: cron/service-role OU gestor/admin autenticado (cobrança) ---
    const cronDenied = requireCronAuth(req);
    if (cronDenied) {
      const COBRANCA_TIPOS = ["cobranca", "cobranca_visita"];
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.startsWith("Bearer ") || !COBRANCA_TIPOS.includes(String(tipo))) {
        L.warn("Unauthorized call", { tipo });
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(
        authHeader.replace("Bearer ", ""),
      );
      const userId = claimsData?.claims?.sub;
      if (claimsError || !userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const admin = getSupabase();
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const allowed = (roles ?? []).some((r: { role: string }) =>
        ["admin", "gestor", "diretor"].includes(r.role)
      );
      if (!allowed) {
        L.warn("Forbidden call", { tipo, userId });
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


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
          name: "novo_leaduhome",
          language: { code: "pt_BR" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: dados.nome || "Lead" },
                { type: "text", text: dados.empreendimento || "Não identificado" },
              ],
            },
          ],
        },
      }),

    };

    // Fallback text messages for types without templates
    const TEXT_MESSAGES: Record<string, () => string> = {
      sla_urgente: () => `🚨 *Lead precisa de atenção URGENTE!*\n\n👤 *${dados.nome || "Lead"}*\n🏢 ${dados.empreendimento || "Não identificado"}\n⏰ SLA de atendimento atingido!\n\nAbra o UhomeSales e faça contato agora!`,
      aviso_1h: () => `⚠️ *Lead sem contato há 1 hora!*\n\n👤 *${dados.nome}*\n🏢 ${dados.empreendimento}\n\nFaça a primeira interação agora no UhomeSales!`,
      aviso_1h30: () => `⚠️ *Segundo aviso — 1h30 sem contato!*\n\n👤 *${dados.nome}*\n🏢 ${dados.empreendimento}\n\nUrgente! Acesse o sistema agora.`,
      aviso_repasse: () => `🔴 *ÚLTIMO AVISO — Lead repassado em 30 min!*\n\n👤 *${dados.nome}*\n🏢 ${dados.empreendimento}\n\nApós 3 avisos o lead será repassado para outro corretor.`,
      lead_expirado_gestor: () => `📋 *Lead repassado por inatividade*\n\nCorretor: ${dados.corretor}\nLead: ${dados.nome} — ${dados.empreendimento}\n\nLead devolvido para a fila automaticamente.`,
      cobranca: () => dados.mensagem_personalizada || dados.mensagem || "",
      cadencia_sem_contato: () => dados.mensagem || "",
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
      L.info("Sent successfully", { tipo, to: numeroFinal, canal: "meta", messageId: result?.messages?.[0]?.id });
      logOps("info", "integration", `WhatsApp enviado (meta): ${tipo}`, { tipo, to: numeroFinal, canal: "meta" });
      return new Response(JSON.stringify({ ...result, canal: "meta" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    L.error("API error", { tipo, to: numeroFinal, status: response.status, error: result?.error });

    // Fallback interno: texto livre pela própria Meta (sem telefone/e-mail no corpo)
    const fallbackText =
      tipo === "novo_lead"
        ? `🆕 *Novo lead recebido!*\n\nNome: ${dados?.nome || "Lead"}\nEmpreendimento: ${dados?.empreendimento || "Não identificado"}\n\nAceite o lead em até 10 minutos para ver os dados de contato.\nhttps://uhomesales.com/pipeline`
        : (TEXT_MESSAGES[tipo] ? TEXT_MESSAGES[tipo]() : "");



    // Último recurso: texto livre pela própria Meta (funciona dentro da janela de 24h)
    if (body.type === "template" && fallbackText) {
      const textResp = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: numeroFinal,
          type: "text",
          text: { body: fallbackText },
        }),
      });
      const textResult = await textResp.json();
      if (textResp.ok) {
        L.info("Sent via Meta text fallback", { tipo, to: numeroFinal, canal: "meta_text" });
        logOps("info", "integration", `WhatsApp enviado (meta texto fallback): ${tipo}`, { tipo, to: numeroFinal, canal: "meta_text" });
        return new Response(JSON.stringify({ ...textResult, canal: "meta_text" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      L.warn("Meta text fallback failed", { tipo, status: textResp.status, error: textResult?.error });
    }


    logOps(
      "error",
      "integration",
      `WhatsApp API error: ${response.status} (template e texto Meta falharam)`,
      { tipo, to: numeroFinal, status: response.status, canal: "none" },
      JSON.stringify(result?.error || {})
    );

    return new Response(JSON.stringify({ ...result, canal: "none" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
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
