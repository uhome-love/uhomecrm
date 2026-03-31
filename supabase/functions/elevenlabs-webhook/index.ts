/**
 * elevenlabs-webhook — Unified handler for ElevenLabs integration
 * 
 * Supports THREE modes:
 * 1) Agent Tool Call (during conversation) — agent sends structured data mid-call
 * 2) Post-Call Webhook (after call ends) — ElevenLabs sends transcription/failure/audio
 * 3) Twilio Status Callback — Twilio sends call status updates (ringing, in-progress, completed, etc.)
 * 
 * IMPORTANT: verify_jwt = false in config.toml — ElevenLabs/Twilio cannot send JWTs
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, handleCors } from "../_shared/cors.ts";

// ── Helpers ──

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  return digits;
}

function phoneVariants(norm: string): string[] {
  const variants = new Set<string>();
  variants.add(norm);
  variants.add(`55${norm}`);
  variants.add(`+55${norm}`);
  if (norm.length === 11) variants.add(norm.slice(0, 2) + norm.slice(3));
  if (norm.length === 10) variants.add(norm.slice(0, 2) + "9" + norm.slice(2));
  return [...variants];
}

// ── Notify orchestrator for lead scoring ──
async function notifyOrchestrator(supabaseUrl: string, serviceKey: string, event_type: string, pipeline_lead_id: string, canal: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/nurturing-orchestrator`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ event_type, pipeline_lead_id, canal }),
    });
  } catch (e) {
    console.error("Orchestrator notify failed:", e);
  }
}

const POSITIVE_STATUSES = [
  "interesse", "positivo", "com_interesse", "qualificado", "visita_marcada",
  "interessado_quente", "interessado_morno", "quer_visita", "quer_whatsapp",
  "interessado", "quer_informacoes", "pediu_contato",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();
  if (req.method === "GET") return jsonResponse({ status: "ok", service: "elevenlabs-webhook" });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const aiSecret = Deno.env.get("UHOME_AI_SECRET");

  // ── Detect content type ──
  const contentType = req.headers.get("content-type") || "";

  // Twilio sends form-urlencoded
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return handleTwilioStatus(req, supabase);
  }

  // ElevenLabs sends JSON
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  console.info("[elevenlabs-webhook] Received payload keys:", Object.keys(body));
  console.info("[elevenlabs-webhook] Full payload:", JSON.stringify(body).slice(0, 2000));

  // ── Detect mode: post-call webhook vs agent tool call ──
  const eventType = body.type as string | undefined;
  const isPostCallWebhook = eventType && [
    "post_call_transcription",
    "post_call_audio",
    "call_initiation_failure",
  ].includes(eventType);

  if (isPostCallWebhook) {
    return handlePostCallWebhook(body, eventType!, supabase, supabaseUrl, serviceKey, aiSecret);
  } else {
    return handleAgentToolCall(body, supabase, supabaseUrl, serviceKey, aiSecret);
  }
});

// ═══════════════════════════════════════════════════════════
// TWILIO STATUS CALLBACK (form-urlencoded)
// ═══════════════════════════════════════════════════════════
async function handleTwilioStatus(
  req: Request,
  supabase: ReturnType<typeof createClient>,
) {
  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const callStatus = formData.get("CallStatus") as string;
    const duration = formData.get("CallDuration") as string;

    if (!callSid) {
      return new Response("Missing CallSid", { status: 400 });
    }

    console.info(`[elevenlabs-webhook] Twilio status: ${callSid} → ${callStatus}`);

    const update: Record<string, unknown> = {
      status: callStatus,
      updated_at: new Date().toISOString(),
    };

    if (duration) {
      update.duracao_segundos = parseInt(duration, 10);
    }

    if (["completed", "busy", "no-answer", "failed", "canceled"].includes(callStatus)) {
      update.finalizado_at = new Date().toISOString();
    }

    // Try matching by twilio_call_sid (CA...) 
    const { data: byTwilio } = await supabase
      .from("ai_calls")
      .update(update)
      .eq("twilio_call_sid", callSid)
      .select("id")
      .maybeSingle();

    if (!byTwilio) {
      // Twilio SID might not be stored - try other approaches
      console.warn(`[elevenlabs-webhook] No ai_calls match for Twilio SID ${callSid}`);
    }

    return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
  } catch (err) {
    console.error("[elevenlabs-webhook] Twilio status error:", err);
    return new Response("Error", { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════
// MODE 1: Agent Tool Call (during conversation)
// ═══════════════════════════════════════════════════════════
async function handleAgentToolCall(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  aiSecret: string | undefined,
) {
  console.info("[elevenlabs-webhook] Processing as AGENT TOOL CALL");

  const {
    lead_id,
    status,
    resumo,
    finalidade,
    regiao_interesse,
    faixa_investimento,
    prazo_compra,
    proxima_acao,
    prioridade,
    telefone,
    nome,
    email,
    empreendimento,
    conversation_id,
  } = body as Record<string, string>;

  const classStatus = status || "desconhecido";
  const classResumo = resumo || "Sem resumo";
  const classPrioridade = prioridade || "media";
  const classProximaAcao = proxima_acao || "Aguardar análise";

  // ── Update ai_calls if we can match ──
  const matchedCallId = await findAiCall(supabase, conversation_id, telefone, lead_id);

  if (matchedCallId) {
    const isPositive = POSITIVE_STATUSES.includes(classStatus.toLowerCase());
    await supabase.from("ai_calls").update({
      status: isPositive ? "completed_positive" : "completed",
      resultado: classStatus,
      resumo_ia: classResumo,
      updated_at: new Date().toISOString(),
    }).eq("id", matchedCallId);
    console.info(`[elevenlabs-webhook] ai_calls updated: ${matchedCallId}, status=${classStatus}, positive=${isPositive}`);
  } else {
    console.warn(`[elevenlabs-webhook] No ai_calls match found for tool call`);
  }

  // ── Forward to ia-call-result for pipeline processing ──
  if (aiSecret) {
    try {
      const iaPayload = {
        lead_id: lead_id || null,
        status: classStatus,
        resumo: classResumo,
        finalidade: finalidade || null,
        regiao_interesse: regiao_interesse || null,
        faixa_investimento: faixa_investimento || null,
        prazo_compra: prazo_compra || null,
        proxima_acao: classProximaAcao,
        prioridade: classPrioridade,
        telefone: telefone || null,
        nome: nome || null,
        email: email || null,
        empreendimento: empreendimento || null,
      };

      const res = await fetch(`${supabaseUrl}/functions/v1/ia-call-result`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(iaPayload),
      });
      const result = await res.json();
      console.info(`[elevenlabs-webhook] ia-call-result response:`, JSON.stringify(result));

      return jsonResponse({
        success: true,
        action: "tool_call_processed",
        matched_call: matchedCallId,
        ia_result: result,
      });
    } catch (e) {
      console.error(`[elevenlabs-webhook] ia-call-result failed:`, e instanceof Error ? e.message : String(e));
    }
  } else {
    console.warn("[elevenlabs-webhook] UHOME_AI_SECRET not set — skipping ia-call-result");
  }

  return jsonResponse({ success: true, action: "tool_call_acknowledged", matched_call: matchedCallId });
}

// ═══════════════════════════════════════════════════════════
// MODE 2: Post-Call Webhook (after call ends)
// ═══════════════════════════════════════════════════════════
async function handlePostCallWebhook(
  body: Record<string, unknown>,
  eventType: string,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  aiSecret: string | undefined,
) {
  console.info(`[elevenlabs-webhook] Processing as POST-CALL WEBHOOK: ${eventType}`);

  // ── CASE: Call initiation failure ──
  if (eventType === "call_initiation_failure") {
    const data = body.data as Record<string, unknown> || body;
    const conversationId = (data.conversation_id || body.conversation_id) as string;
    const failureReason = (data.failure_reason || body.failure_reason) as string || "unknown";

    const matchedCallId = await findAiCall(supabase, conversationId, null, null);

    if (matchedCallId) {
      const statusMap: Record<string, string> = {
        "busy": "nao_atendeu",
        "no-answer": "nao_atendeu",
      };
      await supabase.from("ai_calls").update({
        status: statusMap[failureReason] || "erro",
        resultado: `Falha: ${failureReason}`,
        finalizado_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", matchedCallId);
      console.info(`[elevenlabs-webhook] Failure updated: ${matchedCallId}, reason=${failureReason}`);
    } else {
      console.warn(`[elevenlabs-webhook] No ai_calls match for failure conv=${conversationId}`);
    }

    return jsonResponse({ success: true, action: "failure_processed", matched_call: matchedCallId });
  }

  // ── CASE: Post-call transcription ──
  if (eventType === "post_call_transcription") {
    const data = body.data as Record<string, unknown> || body;
    const conversationId = (data.conversation_id || body.conversation_id) as string;
    const transcript = data.transcript as Array<{ role: string; message: string }> | undefined;
    const analysis = data.analysis as Record<string, unknown> | undefined;
    const clientData = data.conversation_initiation_client_data as Record<string, unknown> | undefined;

    const dynamicVars = clientData?.dynamic_variables as Record<string, string> | undefined;
    const leadId = dynamicVars?.lead_id;
    const nome = dynamicVars?.nome;
    const telefone = dynamicVars?.telefone;
    const empreendimento = dynamicVars?.empreendimento;

    const transcriptSummary = (analysis?.transcript_summary as string) || "";
    const callSuccessful = (analysis?.call_successful as string) || "";
    const dataCollection = (analysis?.data_collection_results as Record<string, unknown>) || {};

    const callDuration = (data.call_duration_secs as number) || 
                         ((data.metadata as Record<string, unknown>)?.call_duration_secs as number) || 0;

    console.info(`[elevenlabs-webhook] Transcription: conv=${conversationId}, duration=${callDuration}s, summary=${transcriptSummary.slice(0, 100)}`);

    // ── Find matching ai_calls record ──
    const matchedCallId = await findAiCall(supabase, conversationId, telefone, leadId);

    // ── Classify from analysis ──
    const interesse = (dataCollection.interesse as { value?: string })?.value || "";
    const finalidade = (dataCollection.finalidade as { value?: string })?.value || "";
    const regiao = (dataCollection.regiao_interesse as { value?: string })?.value || "";
    const faixaInvestimento = (dataCollection.faixa_investimento as { value?: string })?.value || "";
    const prazoCompra = (dataCollection.prazo_compra as { value?: string })?.value || "";

    let status = "sem_interesse";
    const summaryLower = transcriptSummary.toLowerCase();
    if (callSuccessful === "success" || summaryLower.includes("interesse") || interesse.toLowerCase().includes("sim")) {
      status = "com_interesse";
    } else if (summaryLower.includes("não atend") || summaryLower.includes("voicemail") || summaryLower.includes("caixa postal")) {
      status = "nao_atendeu";
    } else if (summaryLower.includes("ocupado") || summaryLower.includes("busy")) {
      status = "nao_atendeu";
    }

    const isPositive = POSITIVE_STATUSES.includes(status.toLowerCase());
    const prioridade = isPositive ? "alta" : "baixa";
    const proxima_acao = isPositive
      ? "Entrar em contato — interesse detectado na ligação IA"
      : status === "nao_atendeu" ? "Tentar nova ligação" : "Nenhuma ação necessária";

    // ── Update ai_calls ──
    if (matchedCallId) {
      // Get additional info from the matched call
      const { data: callInfo } = await supabase
        .from("ai_calls")
        .select("lead_id, telefone, nome_lead, empreendimento")
        .eq("id", matchedCallId)
        .single();

      await supabase.from("ai_calls").update({
        status: isPositive ? "completed_positive" : status === "nao_atendeu" ? "nao_atendeu" : "completed",
        resultado: status,
        resumo_ia: transcriptSummary || null,
        duracao_segundos: callDuration,
        finalizado_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", matchedCallId);
      console.info(`[elevenlabs-webhook] ai_calls updated: ${matchedCallId}, status=${status}, positive=${isPositive}`);

      // ── Update voice_call_logs if exists ──
      if (callInfo?.lead_id) {
        await supabase.from("voice_call_logs")
          .update({
            status: status === "nao_atendeu" ? "nao_atendeu" : "atendida",
            resultado: isPositive ? "interessado" : "sem_interesse",
            duracao_segundos: callDuration,
            resumo_ia: transcriptSummary || null,
            finalizado_at: new Date().toISOString(),
          } as any)
          .eq("ai_call_id", matchedCallId);

        // ── Update voice_campaigns counters ──
        const { data: voiceLog } = await supabase
          .from("voice_call_logs")
          .select("campaign_id")
          .eq("ai_call_id", matchedCallId)
          .maybeSingle();

        if (voiceLog?.campaign_id) {
          const field = status === "nao_atendeu" ? "nao_atenderam" : isPositive ? "interessados" : "atendidas";
          const { data: campaign } = await supabase
            .from("voice_campaigns")
            .select("atendidas, nao_atenderam, interessados")
            .eq("id", voiceLog.campaign_id)
            .single();
          if (campaign) {
            await supabase.from("voice_campaigns")
              .update({ [field]: ((campaign as any)[field] || 0) + 1 } as any)
              .eq("id", voiceLog.campaign_id);
          }
        }

        // ── Notify orchestrator ──
        const orchEvent = status === "nao_atendeu" ? "voz_nao_atendeu" : "voz_atendida";
        notifyOrchestrator(supabaseUrl, serviceKey, orchEvent, callInfo.lead_id, "voz");
      }

      // ── Forward to ia-call-result for pipeline processing ──
      if (aiSecret) {
        try {
          const iaPayload = {
            lead_id: callInfo?.lead_id || leadId || null,
            status,
            resumo: transcriptSummary || "Sem resumo disponível",
            finalidade: finalidade || null,
            regiao_interesse: regiao || null,
            faixa_investimento: faixaInvestimento || null,
            prazo_compra: prazoCompra || null,
            proxima_acao,
            prioridade,
            telefone: callInfo?.telefone || telefone || null,
            nome: callInfo?.nome_lead || nome || null,
            email: null,
            empreendimento: callInfo?.empreendimento || empreendimento || null,
          };

          console.info(`[elevenlabs-webhook] Forwarding to ia-call-result:`, JSON.stringify(iaPayload).slice(0, 500));

          const res = await fetch(`${supabaseUrl}/functions/v1/ia-call-result`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${aiSecret}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(iaPayload),
          });
          const result = await res.json();
          console.info(`[elevenlabs-webhook] ia-call-result response:`, JSON.stringify(result));
        } catch (e) {
          console.error(`[elevenlabs-webhook] ia-call-result failed:`, e instanceof Error ? e.message : String(e));
        }
      }
    } else {
      console.warn(`[elevenlabs-webhook] No ai_calls match for transcription conv=${conversationId}`);
    }

    return jsonResponse({
      success: true,
      action: "transcription_processed",
      conversation_id: conversationId,
      status,
      positive: isPositive,
      matched_call: matchedCallId,
    });
  }

  // ── CASE: Audio webhook ──
  if (eventType === "post_call_audio") {
    console.info("[elevenlabs-webhook] Audio webhook acknowledged");
    return jsonResponse({ success: true, action: "audio_acknowledged" });
  }

  return jsonResponse({ success: true, action: "unknown_event_acknowledged" });
}

// ═══════════════════════════════════════════════════════════
// HELPER: Find ai_calls record by conversation_id, phone, or lead_id
// ═══════════════════════════════════════════════════════════
async function findAiCall(
  supabase: ReturnType<typeof createClient>,
  conversationId: string | null | undefined,
  telefone: string | null | undefined,
  leadId: string | null | undefined,
): Promise<string | null> {
  // 1. By elevenlabs_conversation_id (conv_...)
  if (conversationId) {
    const { data } = await supabase
      .from("ai_calls")
      .select("id")
      .eq("elevenlabs_conversation_id", conversationId)
      .maybeSingle();
    if (data?.id) return data.id;

    // Also try twilio_call_sid (backward compat — old records store conv_ there)
    const { data: bySid } = await supabase
      .from("ai_calls")
      .select("id")
      .eq("twilio_call_sid", conversationId)
      .maybeSingle();
    if (bySid?.id) return bySid.id;
  }

  // 2. By lead_id + recent
  if (leadId) {
    const { data } = await supabase
      .from("ai_calls")
      .select("id")
      .eq("lead_id", leadId)
      .in("status", ["initiated", "in-progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // 3. By phone + recent (multiple formats)
  if (telefone) {
    const norm = normalizePhone(telefone);
    const variants = phoneVariants(norm);

    for (const variant of variants) {
      // Try with + prefix
      for (const phone of [variant, `+${variant}`]) {
        const { data } = await supabase
          .from("ai_calls")
          .select("id")
          .eq("telefone", phone)
          .in("status", ["initiated", "in-progress"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.id) return data.id;
      }
    }
  }

  return null;
}
