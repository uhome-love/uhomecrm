/**
 * whatsapp-ai-reply — Auto-reply to new WhatsApp leads using HOMI persona
 * 
 * Receives: { telefone, nome_contato, mensagem, lead_id, tipo_mensagem? }
 * 1. Loads enterprise knowledge
 * 2. Calls Lovable AI Gateway (gemini-2.5-flash) with HOMI persona
 * 3. Sends reply via Meta WhatsApp API
 * 4. Logs to whatsapp_ai_log
 * 5. Marks ai_replied = true on pipeline_leads
 * 6. Registers timeline activity
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireApiKey, callAI } from "../_shared/ai-helpers.ts";
import { loadEnterpriseKnowledge, formatForList } from "../_shared/enterprise-knowledge.ts";

const META_API_BASE = "https://graph.facebook.com/v21.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let telefone = "", nome_contato = "", mensagem = "", lead_id = "", tipo_mensagem = "texto";

  try {
    const body = await req.json();
    telefone = body.telefone || "";
    nome_contato = body.nome_contato || "";
    mensagem = body.mensagem || "";
    lead_id = body.lead_id || "";
    tipo_mensagem = body.tipo_mensagem || "texto";

    if (!telefone) {
      return errorResponse("telefone is required", 400);
    }

    // For media messages (audio, image, video, document), use a standard greeting
    const isMedia = ["image", "audio", "video", "document"].includes(tipo_mensagem);
    let respostaIA = "";

    if (isMedia || !mensagem.trim()) {
      // Standard greeting for media/empty messages
      respostaIA = `Olá${nome_contato ? `, ${nome_contato.split(" ")[0]}` : ""}! 👋 Aqui é a HOMI, assistente virtual da UHome. Recebi sua mensagem! Um corretor especializado vai entrar em contato com você em breve para te ajudar. 😊`;
    } else {
      // Load enterprise knowledge and call AI
      const apiKey = requireApiKey();
      const knowledge = await loadEnterpriseKnowledge(supabase);
      const empreendimentosList = formatForList(knowledge);

      const systemPrompt = `Você é a HOMI, assistente virtual da UHome Imóveis, a principal assessoria imobiliária de Porto Alegre/RS.

PERSONALIDADE: Simpática, profissional, empática. Use emojis com moderação (1-2 por mensagem). Linguagem natural e acolhedora.

OBJETIVO: Dar as boas-vindas ao lead que acabou de entrar em contato pelo WhatsApp. Fazer uma saudação personalizada e mostrar que a UHome pode ajudá-lo.

REGRAS IMPORTANTES:
- NÃO prometa tempo específico de resposta do corretor (não diga "em X minutos")
- Diga que "nossa equipe vai te atender em breve"
- Se a mensagem do lead mencionar um empreendimento específico, demonstre conhecimento sobre ele
- Se a mensagem for genérica, pergunte o que o lead está buscando (tipo de imóvel, região, investimento)
- Seja BREVE: máximo 3-4 frases
- NUNCA invente informações sobre preços ou disponibilidade
- Use o primeiro nome do lead quando disponível

EMPREENDIMENTOS DISPONÍVEIS:
${empreendimentosList}`;

      const userMessage = nome_contato
        ? `Lead "${nome_contato}" enviou a seguinte mensagem pelo WhatsApp: "${mensagem}"`
        : `Um lead enviou a seguinte mensagem pelo WhatsApp: "${mensagem}"`;

      respostaIA = await callAI(apiKey, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ], {
        model: "google/gemini-2.5-flash",
        fnName: "whatsapp-ai-reply",
        temperature: 0.7,
        maxTokens: 300,
      });
    }

    if (!respostaIA.trim()) {
      respostaIA = `Olá${nome_contato ? `, ${nome_contato.split(" ")[0]}` : ""}! 👋 Bem-vindo à UHome! Nossa equipe vai te atender em breve. 😊`;
    }

    // Send via Meta WhatsApp API
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    let sendSuccess = false;
    let sendError = "";

    if (accessToken && phoneNumberId) {
      try {
        const metaResp = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: telefone,
            type: "text",
            text: { body: respostaIA },
          }),
        });

        if (metaResp.ok) {
          sendSuccess = true;
          console.log(`✅ AI reply sent to ${telefone}`);
        } else {
          const errBody = await metaResp.text();
          sendError = `Meta API ${metaResp.status}: ${errBody.slice(0, 200)}`;
          console.error(`❌ Meta API error sending to ${telefone}:`, sendError);
        }
      } catch (e) {
        sendError = e instanceof Error ? e.message : "Unknown send error";
        console.error(`❌ Send error:`, sendError);
      }
    } else {
      sendError = "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured";
      console.error(sendError);
    }

    // Get corretor name for log
    let corretorNome: string | null = null;
    if (lead_id) {
      const { data: leadData } = await supabase
        .from("pipeline_leads")
        .select("corretor_id")
        .eq("id", lead_id)
        .maybeSingle();
      
      if (leadData?.corretor_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", leadData.corretor_id)
          .maybeSingle();
        corretorNome = profile?.nome || null;
      }
    }

    // Insert log
    const logStatus = sendSuccess ? "resposta_enviada" : (sendError ? "erro_envio" : "resposta_gerada");
    await supabase.from("whatsapp_ai_log").insert({
      telefone,
      nome_contato: nome_contato || null,
      mensagem_recebida: mensagem || (isMedia ? `[${tipo_mensagem}]` : null),
      tipo_mensagem,
      filtro_resultado: "aprovado",
      resposta_ia: respostaIA,
      lead_id: lead_id || null,
      corretor_nome: corretorNome,
      status: logStatus,
      erro_detalhe: sendError || null,
    });

    // Mark ai_replied on lead
    if (lead_id) {
      await supabase
        .from("pipeline_leads")
        .update({ ai_replied: true })
        .eq("id", lead_id);

      // Timeline entry
      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: lead_id,
        tipo: "whatsapp",
        titulo: "🤖 Resposta automática HOMI enviada",
        descricao: `HOMI respondeu automaticamente: "${respostaIA.slice(0, 200)}"`,
        data: new Date().toISOString().slice(0, 10),
        status: "concluida",
      });
    }

    return jsonResponse({ 
      ok: true, 
      sent: sendSuccess, 
      resposta: respostaIA.slice(0, 100),
    });

  } catch (e) {
    console.error("whatsapp-ai-reply error:", e);

    // Log error
    try {
      await supabase.from("whatsapp_ai_log").insert({
        telefone: telefone || null,
        nome_contato: nome_contato || null,
        mensagem_recebida: mensagem || null,
        tipo_mensagem,
        status: "erro",
        erro_detalhe: e instanceof Error ? e.message : "Unknown error",
        lead_id: lead_id || null,
      });
    } catch { /* ignore logging error */ }

    // If it's a Response from AI helpers, return it
    if (e instanceof Response) return e;

    return errorResponse(e instanceof Error ? e.message : "Unknown error");
  }
});
