/**
 * elevenlabs-webhook — Receives ElevenLabs post-call webhooks
 * Processes transcription results and call failures, syncing to ai_calls + ia_call_results
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  // Accept GET for health checks
  if (req.method === "GET") {
    return jsonResponse({ status: "ok", service: "elevenlabs-webhook" });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ── Auth: verify via UHOME_AI_SECRET header OR ElevenLabs signature ──
  // ElevenLabs sends webhooks without our custom auth, so we validate
  // the webhook secret if configured, otherwise accept (webhook URL is secret)
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const secret = Deno.env.get("UHOME_AI_SECRET");

  // Optional: validate ElevenLabs signature header if HMAC secret is set
  // For now, we accept all POST requests (the URL itself is the secret)

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const eventType = body.type as string;
  console.info(`[elevenlabs-webhook] Received event: ${eventType}`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ──────────────────────────────────────────────────
  // CASE 1: Call initiation failure
  // ──────────────────────────────────────────────────
  if (eventType === "call_initiation_failure") {
    const data = body.data as Record<string, unknown>;
    const conversationId = data.conversation_id as string;
    const failureReason = data.failure_reason as string || "unknown";
    const metadata = data.metadata as Record<string, unknown> | undefined;

    // Try to find the ai_calls record by conversation_id
    const { data: call } = await supabase
      .from("ai_calls")
      .select("id, lead_id, telefone, nome_lead, empreendimento")
      .eq("twilio_call_sid", conversationId)
      .maybeSingle();

    // Also try matching by phone from Twilio metadata
    let matchedCall = call;
    if (!matchedCall && metadata?.type === "twilio") {
      const twilioBody = metadata.body as Record<string, string>;
      const calledPhone = twilioBody?.Called || twilioBody?.To;
      if (calledPhone) {
        const { data: phoneCall } = await supabase
          .from("ai_calls")
          .select("id, lead_id, telefone, nome_lead, empreendimento")
          .eq("telefone", calledPhone)
          .eq("status", "initiated")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        matchedCall = phoneCall;
      }
    }

    if (matchedCall) {
      // Map failure reasons
      const statusMap: Record<string, string> = {
        "busy": "nao_atendeu",
        "no-answer": "nao_atendeu",
        "unknown": "erro",
      };
      const mappedStatus = statusMap[failureReason] || "erro";

      await supabase.from("ai_calls").update({
        status: mappedStatus,
        resultado: `Falha: ${failureReason}`,
        finalizado_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", matchedCall.id);

      console.info(`[elevenlabs-webhook] Call failure updated: ${matchedCall.id}, reason=${failureReason}`);
    } else {
      console.warn(`[elevenlabs-webhook] No ai_calls match for failure, conversation_id=${conversationId}`);
    }

    return jsonResponse({ success: true, action: "failure_processed" });
  }

  // ──────────────────────────────────────────────────
  // CASE 2: Post-call transcription (main case)
  // ──────────────────────────────────────────────────
  if (eventType === "post_call_transcription") {
    const data = body.data as Record<string, unknown>;
    const conversationId = data.conversation_id as string;
    const agentId = data.agent_id as string;
    const transcript = data.transcript as Array<{ role: string; message: string; time_in_call_secs?: number }> | undefined;
    const metadata = data.metadata as Record<string, unknown> | undefined;
    const analysis = data.analysis as Record<string, unknown> | undefined;
    const clientData = data.conversation_initiation_client_data as Record<string, unknown> | undefined;

    // Extract dynamic variables we passed during call initiation
    const dynamicVars = clientData?.dynamic_variables as Record<string, string> | undefined;
    const leadId = dynamicVars?.lead_id;
    const nome = dynamicVars?.nome;
    const telefone = dynamicVars?.telefone;
    const empreendimento = dynamicVars?.empreendimento;

    // Extract analysis results
    const transcriptSummary = analysis?.transcript_summary as string || "";
    const callSuccessful = analysis?.call_successful as string || "";
    const dataCollectionResults = analysis?.data_collection_results as Record<string, unknown> || {};
    const evaluationResults = analysis?.evaluation_criteria_results as Record<string, unknown> || {};

    // Extract call metadata
    const callDuration = metadata?.call_duration_secs as number || 0;

    console.info(`[elevenlabs-webhook] Transcription for conversation=${conversationId}, agent=${agentId}, duration=${callDuration}s`);

    // ── Find matching ai_calls record ──
    let matchedCall: { id: string; lead_id: string | null; telefone: string; nome_lead: string | null; empreendimento: string | null } | null = null;

    // By conversation_id / call_sid
    const { data: bySid } = await supabase
      .from("ai_calls")
      .select("id, lead_id, telefone, nome_lead, empreendimento")
      .eq("twilio_call_sid", conversationId)
      .maybeSingle();
    matchedCall = bySid;

    // Fallback: by phone + recent initiated status
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

    // ── Determine call classification from analysis ──
    // Extract data collection fields (configured in ElevenLabs agent)
    const interesse = (dataCollectionResults.interesse as { value?: string })?.value || "";
    const finalidade = (dataCollectionResults.finalidade as { value?: string })?.value || "";
    const regiao = (dataCollectionResults.regiao_interesse as { value?: string })?.value || "";
    const faixaInvestimento = (dataCollectionResults.faixa_investimento as { value?: string })?.value || "";
    const prazoCompra = (dataCollectionResults.prazo_compra as { value?: string })?.value || "";

    // Determine status from analysis
    let status = "sem_interesse";
    const successLower = callSuccessful.toLowerCase();
    const summaryLower = transcriptSummary.toLowerCase();

    if (successLower === "success" || summaryLower.includes("interesse") || summaryLower.includes("interest") || interesse.toLowerCase().includes("sim")) {
      status = "com_interesse";
    } else if (summaryLower.includes("não atend") || summaryLower.includes("voicemail") || summaryLower.includes("caixa postal")) {
      status = "nao_atendeu";
    } else if (summaryLower.includes("recusou") || summaryLower.includes("não quer") || summaryLower.includes("sem interesse")) {
      status = "sem_interesse";
    }

    // Determine priority
    let prioridade = "media";
    if (status === "com_interesse") {
      prioridade = faixaInvestimento ? "alta" : "media";
    } else {
      prioridade = "baixa";
    }

    const proxima_acao = status === "com_interesse"
      ? "Entrar em contato — lead demonstrou interesse na ligação IA"
      : status === "nao_atendeu"
        ? "Tentar nova ligação"
        : "Nenhuma ação necessária";

    // ── Update ai_calls record ──
    if (matchedCall) {
      await supabase.from("ai_calls").update({
        status: status === "com_interesse" ? "completed_positive" : status === "nao_atendeu" ? "nao_atendeu" : "completed",
        resultado: status,
        resumo_ia: transcriptSummary || null,
        duracao_segundos: callDuration,
        finalizado_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", matchedCall.id);

      console.info(`[elevenlabs-webhook] ai_calls updated: ${matchedCall.id}, status=${status}`);
    } else {
      console.warn(`[elevenlabs-webhook] No ai_calls match for conversation_id=${conversationId}`);
    }

    // ── Forward to ia-call-result logic ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const aiSecret = Deno.env.get("UHOME_AI_SECRET");

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
          proxima_acao: proxima_acao,
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
        console.error(`[elevenlabs-webhook] Failed to call ia-call-result:`, e instanceof Error ? e.message : String(e));
      }
    } else {
      console.warn("[elevenlabs-webhook] UHOME_AI_SECRET not set, skipping ia-call-result forwarding");
    }

    return jsonResponse({
      success: true,
      action: "transcription_processed",
      conversation_id: conversationId,
      status,
      matched_call: matchedCall?.id || null,
    });
  }

  // ── CASE 3: Audio webhook (just acknowledge) ──
  if (eventType === "post_call_audio") {
    console.info("[elevenlabs-webhook] Audio webhook received, acknowledged");
    return jsonResponse({ success: true, action: "audio_acknowledged" });
  }

  // Unknown event type
  console.warn(`[elevenlabs-webhook] Unknown event type: ${eventType}`);
  return jsonResponse({ success: true, action: "unknown_event_acknowledged" });
});
