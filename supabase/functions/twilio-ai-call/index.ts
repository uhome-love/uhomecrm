/**
 * twilio-ai-call — Initiates an outbound call via ElevenLabs native Twilio integration
 * CEO-only feature for automated lead prospecting calls.
 * Uses POST https://api.elevenlabs.io/v1/convai/twilio/outbound-call
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  // ── Auth: verify user is admin ──
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return errorResponse("Unauthorized", 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claims?.claims) return errorResponse("Unauthorized", 401);
  const userId = claims.claims.sub as string;

  // Check admin role
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: role } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) return errorResponse("Forbidden: admin only", 403);

  // ── Parse body ──
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { lead_id, telefone, nome, empreendimento, context } = body as Record<string, string>;
  if (!telefone) return errorResponse("Missing telefone", 400);

  // ── Check required env vars ──
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_CONVAI_KEY") || Deno.env.get("ELEVENLABS_API_KEY");
  if (!ELEVENLABS_API_KEY) return errorResponse("ELEVENLABS API KEY not configured", 500);

  const AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID")?.trim();
  if (!AGENT_ID) return errorResponse("ELEVENLABS_AGENT_ID not configured", 500);

  const PHONE_NUMBER_ID = Deno.env.get("ELEVENLABS_PHONE_NUMBER_ID")?.trim();
  if (!PHONE_NUMBER_ID) return errorResponse("ELEVENLABS_PHONE_NUMBER_ID not configured", 500);
  if (!PHONE_NUMBER_ID.startsWith("phnum_")) {
    return errorResponse(
      "ELEVENLABS_PHONE_NUMBER_ID inválido: use o ID do número no ElevenLabs (formato phnum_...), não API key, SID ou hash.",
      500,
    );
  }

  // Format phone to E.164
  let toPhone = telefone.replace(/\D/g, "");
  if (!toPhone.startsWith("55")) toPhone = `55${toPhone}`;
  toPhone = `+${toPhone}`;

  try {
    const [agentCheckRes, phoneCheckRes] = await Promise.all([
      fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(AGENT_ID)}`, {
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      }),
      fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${encodeURIComponent(PHONE_NUMBER_ID)}`, {
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      }),
    ]);

    if (!agentCheckRes.ok) {
      const agentError = await agentCheckRes.text();
      console.error("[twilio-ai-call] Invalid ELEVENLABS_AGENT_ID:", agentError);
      return errorResponse(`ELEVENLABS_AGENT_ID inválido ou não encontrado: ${agentError}`, 500);
    }

    if (!phoneCheckRes.ok) {
      const phoneError = await phoneCheckRes.text();
      console.error("[twilio-ai-call] Invalid ELEVENLABS_PHONE_NUMBER_ID:", phoneError);
      return errorResponse(`ELEVENLABS_PHONE_NUMBER_ID inválido ou não encontrado: ${phoneError}`, 500);
    }

    // ── Native ElevenLabs outbound call via Twilio ──
    const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        agent_phone_number_id: PHONE_NUMBER_ID,
        to_number: toPhone,
        ...(nome ? { first_message: `Olá ${nome}, tudo bem?` } : {}),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[twilio-ai-call] ElevenLabs outbound error:", data);
      return errorResponse(`ElevenLabs outbound-call falhou: ${JSON.stringify(data)}`, response.status);
    }

    const callSid = data.call_sid || data.sid || data.id || "unknown";

    // ── Log the call ──
    await adminClient.from("ai_calls").insert({
      lead_id: lead_id || null,
      telefone: toPhone,
      nome_lead: nome || null,
      empreendimento: empreendimento || null,
      twilio_call_sid: callSid,
      agent_id: AGENT_ID,
      status: "initiated",
      iniciado_por: userId,
      contexto: context || null,
    });

    console.info(`[twilio-ai-call] Outbound call initiated: ${callSid}, to=${toPhone}`);
    return jsonResponse({ success: true, call_sid: callSid });
  } catch (err) {
    console.error("[twilio-ai-call] Error:", err);
    return errorResponse(`Internal error: ${err instanceof Error ? err.message : "unknown"}`, 500);
  }
});
