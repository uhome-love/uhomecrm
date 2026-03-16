/**
 * twilio-ai-call — Initiates an outbound Twilio call connected to ElevenLabs AI Agent
 * CEO-only feature for automated lead prospecting calls.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse, handleCors } from "../_shared/cors.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

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
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return errorResponse("LOVABLE_API_KEY not configured", 500);

  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  if (!TWILIO_API_KEY) return errorResponse("TWILIO_API_KEY not configured", 500);

  const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!TWILIO_PHONE) return errorResponse("TWILIO_PHONE_NUMBER not configured", 500);

  const AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");
  if (!AGENT_ID) return errorResponse("ELEVENLABS_AGENT_ID not configured", 500);

  // Format phone to E.164
  let toPhone = telefone.replace(/\D/g, "");
  if (!toPhone.startsWith("55")) toPhone = `55${toPhone}`;
  toPhone = `+${toPhone}`;

  // ── TwiML URL (our edge function) ──
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const twimlUrl = `${supabaseUrl}/functions/v1/twilio-ai-twiml?agent_id=${AGENT_ID}&lead_id=${lead_id || ""}&lead_nome=${encodeURIComponent(nome || "")}`;

  // ── Status callback URL ──
  const statusUrl = `${supabaseUrl}/functions/v1/twilio-ai-status`;

  try {
    // Create outbound call via Twilio Gateway
    const response = await fetch(`${GATEWAY_URL}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: toPhone,
        From: TWILIO_PHONE,
        Url: twimlUrl,
        StatusCallback: statusUrl,
        StatusCallbackEvent: "initiated ringing answered completed",
        StatusCallbackMethod: "POST",
        Timeout: "30",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[twilio-ai-call] Twilio error:", data);
      return errorResponse(`Twilio error: ${JSON.stringify(data)}`, response.status);
    }

    // ── Log the call ──
    await adminClient.from("ai_calls").insert({
      lead_id: lead_id || null,
      telefone: toPhone,
      nome_lead: nome || null,
      empreendimento: empreendimento || null,
      twilio_call_sid: data.sid,
      agent_id: AGENT_ID,
      status: "initiated",
      iniciado_por: userId,
      contexto: context || null,
    });

    console.info(`[twilio-ai-call] Call initiated: SID=${data.sid}, to=${toPhone}`);
    return jsonResponse({ success: true, call_sid: data.sid });
  } catch (err) {
    console.error("[twilio-ai-call] Error:", err);
    return errorResponse(`Internal error: ${err instanceof Error ? err.message : "unknown"}`, 500);
  }
});
