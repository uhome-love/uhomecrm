/**
 * twilio-ai-status — Receives Twilio status callbacks for AI calls
 * Updates the ai_calls table with call progress and duration.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const callStatus = formData.get("CallStatus") as string;
    const duration = formData.get("CallDuration") as string;

    if (!callSid) {
      return new Response("Missing CallSid", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const update: Record<string, unknown> = {
      status: callStatus,
      updated_at: new Date().toISOString(),
    };

    if (duration) {
      update.duracao_segundos = parseInt(duration, 10);
    }

    if (callStatus === "completed" || callStatus === "busy" || callStatus === "no-answer" || callStatus === "failed" || callStatus === "canceled") {
      update.finalizado_at = new Date().toISOString();
    }

    await supabase
      .from("ai_calls")
      .update(update)
      .eq("twilio_call_sid", callSid);

    console.info(`[twilio-ai-status] ${callSid} → ${callStatus}${duration ? ` (${duration}s)` : ""}`);

    return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
  } catch (err) {
    console.error("[twilio-ai-status] Error:", err);
    return new Response("Error", { status: 500 });
  }
});
