/**
 * twilio-ai-twiml — Returns TwiML that connects a Twilio call to ElevenLabs Conversational AI
 * Called by Twilio when the outbound call is answered.
 */
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const agentId = url.searchParams.get("agent_id") || Deno.env.get("ELEVENLABS_AGENT_ID");
  const leadId = url.searchParams.get("lead_id") || "";
  const leadNome = url.searchParams.get("lead_nome") || "";

  if (!agentId) {
    console.error("[twilio-ai-twiml] Missing agent_id");
    return new Response("<Response><Say>Erro de configuração.</Say></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!ELEVENLABS_API_KEY) {
    console.error("[twilio-ai-twiml] Missing ELEVENLABS_API_KEY");
    return new Response("<Response><Say>Erro de configuração.</Say></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Get signed URL from ElevenLabs for secure WebSocket connection
  let wsUrl = "";
  try {
    const signedRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
    );
    const signedData = await signedRes.json();
    if (signedData.signed_url) {
      wsUrl = signedData.signed_url;
    } else {
      console.error("[twilio-ai-twiml] No signed_url returned:", signedData);
      return new Response("<Response><Say>Erro ao conectar com agente de voz.</Say></Response>", {
        headers: { "Content-Type": "text/xml" },
      });
    }
  } catch (err) {
    console.error("[twilio-ai-twiml] Error getting signed URL:", err);
    return new Response("<Response><Say>Erro ao conectar com agente de voz.</Say></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Return TwiML that connects to ElevenLabs via Media Stream
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="lead_id" value="${leadId}" />
      <Parameter name="lead_nome" value="${encodeURIComponent(leadNome)}" />
    </Stream>
  </Connect>
</Response>`;

  console.info(`[twilio-ai-twiml] Serving TwiML for lead=${leadId}, agent=${agentId}`);

  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
});
