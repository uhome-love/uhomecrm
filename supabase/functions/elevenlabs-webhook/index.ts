/**
 * elevenlabs-webhook — Unified handler for ElevenLabs integration
 * 
 * Supports TWO modes:
 * 1) Agent Tool Call (during conversation) — agent sends structured data mid-call
 * 2) Post-Call Webhook (after call ends) — ElevenLabs sends transcription/failure/audio
 * 
 * Detection: post-call webhooks have a "type" field (post_call_transcription, etc.)
 *            agent tool calls have custom fields (lead_id, status, resumo, etc.)
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
  if (norm.length === 11) variants.add(norm.slice(0, 2) + norm.slice(3));
  if (norm.length === 10) variants.add(norm.slice(0, 2) + "9" + norm.slice(2));
  return [...variants];
}

const POSITIVE_STATUSES = ["interesse", "positivo", "com_interesse", "qualificado", "visita_marcada"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();
  if (req.method === "GET") return jsonResponse({ status: "ok", service: "elevenlabs-webhook" });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  console.info("[elevenlabs-webhook] Received payload keys:", Object.keys(body));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const aiSecret = Deno.env.get("UHOME_AI_SECRET");

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
// MODE 1: Agent Tool Call (during conversation)
// The agent calls this endpoint with structured data like:
// { lead_id, status, resumo, finalidade, telefone, nome, ... }
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

  // Build classification for logging
  const classStatus = status || "desconhecido";
  const classResumo = resumo || "Sem resumo";
  const classPrioridade = prioridade || "media";
  const classProximaAcao = proxima_acao || "Aguardar análise";

  // ── Update ai_calls if we can match ──
  if (conversation_id || telefone) {
    let matchedCallId: string | null = null;

    if (conversation_id) {
      const { data } = await supabase
        .from("ai_calls")
        .select("id")
        .eq("twilio_call_sid", conversation_id)
        .maybeSingle();
      matchedCallId = data?.id || null;
    }

    if (!matchedCallId && telefone) {
      const norm = normalizePhone(telefone);
      const variants = phoneVariants(norm);
      // Try matching by phone with E.164 format
      const phoneE164 = `+55${norm}`;
      const { data } = await supabase
        .from("ai_calls")
        .select("id")
        .eq("telefone", phoneE164)
        .in("status", ["initiated", "in-progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      matchedCallId = data?.id || null;
    }

    if (matchedCallId) {
      const isPositive = POSITIVE_STATUSES.includes(classStatus.toLowerCase());
      await supabase.from("ai_calls").update({
        status: isPositive ? "completed_positive" : "completed",
        resultado: classStatus,
        resumo_ia: classResumo,
        updated_at: new Date().toISOString(),
      }).eq("id", matchedCallId);
      console.info(`[elevenlabs-webhook] ai_calls updated: ${matchedCallId}`);
    }
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
        ia_result: result,
      });
    } catch (e) {
      console.error(`[elevenlabs-webhook] ia-call-result failed:`, e instanceof Error ? e.message : String(e));
    }
  } else {
    console.warn("[elevenlabs-webhook] UHOME_AI_SECRET not set");
  }

  return jsonResponse({ success: true, action: "tool_call_acknowledged" });
}

// ═══════════════════════════════════════════════════════════
// MODE 2: Post-Call Webhook (after call ends)
// ElevenLabs sends { type: "post_call_transcription", data: {...} }
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
    const data = body.data as Record<string, unknown>;
    const conversationId = data.conversation_id as string;
    const failureReason = data.failure_reason as string || "unknown";
    const metadata = data.metadata as Record<string, unknown> | undefined;

    let matchedCall: { id: string } | null = null;

    const { data: bySid } = await supabase
      .from("ai_calls")
      .select("id")
      .eq("twilio_call_sid", conversationId)
      .maybeSingle();
    matchedCall = bySid;

    // Also try Twilio metadata phone match
    if (!matchedCall && metadata?.type === "twilio") {
      const twilioBody = metadata.body as Record<string, string>;
      const calledPhone = twilioBody?.Called || twilioBody?.To;
      if (calledPhone) {
        const { data: byPhone } = await supabase
          .from("ai_calls")
          .select("id")
          .eq("telefone", calledPhone)
          .eq("status", "initiated")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        matchedCall = byPhone;
      }
    }

    if (matchedCall) {
      const statusMap: Record<string, string> = {
        "busy": "nao_atendeu",
        "no-answer": "nao_atendeu",
        "unknown": "erro",
      };
      await supabase.from("ai_calls").update({
        status: statusMap[failureReason] || "erro",
        resultado: `Falha: ${failureReason}`,
        finalizado_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", matchedCall.id);
      console.info(`[elevenlabs-webhook] Failure updated: ${matchedCall.id}, reason=${failureReason}`);
    }

    return jsonResponse({ success: true, action: "failure_processed" });
  }

  // ── CASE: Post-call transcription ──
  if (eventType === "post_call_transcription") {
    const data = body.data as Record<string, unknown>;
    const conversationId = data.conversation_id as string;
    const agentId = data.agent_id as string;
    const transcript = data.transcript as Array<{ role: string; message: string }> | undefined;
    const metadata = data.metadata as Record<string, unknown> | undefined;
    const analysis = data.analysis as Record<string, unknown> | undefined;
    const clientData = data.conversation_initiation_client_data as Record<string, unknown> | undefined;

    // Dynamic variables we passed during call initiation
    const dynamicVars = clientData?.dynamic_variables as Record<string, string> | undefined;
    const leadId = dynamicVars?.lead_id;
    const nome = dynamicVars?.nome;
    const telefone = dynamicVars?.telefone;
    const empreendimento = dynamicVars?.empreendimento;

    // Analysis data
    const transcriptSummary = analysis?.transcript_summary as string || "";
    const callSuccessful = analysis?.call_successful as string || "";
    const dataCollection = analysis?.data_collection_results as Record<string, unknown> || {};

    const callDuration = metadata?.call_duration_secs as number || 0;

    console.info(`[elevenlabs-webhook] Transcription: conv=${conversationId}, duration=${callDuration}s`);

    // ── Find matching ai_calls record ──
    type AiCallMatch = { id: string; lead_id: string | null; telefone: string; nome_lead: string | null; empreendimento: string | null };
    let matchedCall: AiCallMatch | null = null;

    const { data: bySid } = await supabase
      .from("ai_calls")
      .select("id, lead_id, telefone, nome_lead, empreendimento")
      .eq("twilio_call_sid", conversationId)
      .maybeSingle();
    matchedCall = bySid;

    if (!matchedCall && telefone) {
      const { data: byPhone } = await supabase
        .from("ai_calls")
        .select("id, lead_id, telefone, nome_lead, empreendimento")
        .eq("telefone", telefone)
        .in("status", ["initiated", "in-progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      matchedCall = byPhone;
    }

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
    }

    const prioridade = status === "com_interesse" ? "alta" : "baixa";
    const proxima_acao = status === "com_interesse"
      ? "Entrar em contato — interesse detectado na ligação IA"
      : status === "nao_atendeu" ? "Tentar nova ligação" : "Nenhuma ação necessária";

    // ── Update ai_calls ──
    if (matchedCall) {
      await supabase.from("ai_calls").update({
        status: status === "com_interesse" ? "completed_positive" : status === "nao_atendeu" ? "nao_atendeu" : "completed",
        resultado: status,
        resumo_ia: transcriptSummary || null,
        duracao_segundos: callDuration,
        finalizado_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", matchedCall.id);
      console.info(`[elevenlabs-webhook] ai_calls updated: ${matchedCall.id}`);
    }

    // ── Forward to ia-call-result ──
    if (aiSecret) {
      try {
        const iaPayload = {
          lead_id: matchedCall?.lead_id || leadId || null,
          status,
          resumo: transcriptSummary || "Sem resumo disponível",
          finalidade: finalidade || null,
          regiao_interesse: regiao || null,
          faixa_investimento: faixaInvestimento || null,
          prazo_compra: prazoCompra || null,
          proxima_acao,
          prioridade,
          telefone: matchedCall?.telefone || telefone || null,
          nome: matchedCall?.nome_lead || nome || null,
          email: null,
          empreendimento: matchedCall?.empreendimento || empreendimento || null,
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
      } catch (e) {
        console.error(`[elevenlabs-webhook] ia-call-result failed:`, e instanceof Error ? e.message : String(e));
      }
    }

    return jsonResponse({
      success: true,
      action: "transcription_processed",
      conversation_id: conversationId,
      status,
      matched_call: matchedCall?.id || null,
    });
  }

  // ── CASE: Audio webhook ──
  if (eventType === "post_call_audio") {
    console.info("[elevenlabs-webhook] Audio webhook acknowledged");
    return jsonResponse({ success: true, action: "audio_acknowledged" });
  }

  return jsonResponse({ success: true, action: "unknown_event_acknowledged" });
}
