// Edge function one-shot: valida credenciais Meta CAPI enviando um Test Event.
// Não conta como conversão porque usa test_event_code.
// Uso: POST /meta-capi-ping  (público, sem PII)
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const datasetId = Deno.env.get("META_DATASET_ID");
  const token = Deno.env.get("META_CAPI_TOKEN");
  if (!datasetId || !token) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing META_DATASET_ID or META_CAPI_TOKEN" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // SHA-256 helper
  async function sha256(input: string): Promise<string> {
    const buf = new TextEncoder().encode(input.trim().toLowerCase());
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const payload = {
    data: [
      {
        action_source: "system_generated",
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: `uhome_ping_${Date.now()}`,
        custom_data: { event_source: "crm", lead_event_source: "uhome" },
        user_data: {
          em: [await sha256("ping-test@uhomesales.com")],
          ph: [await sha256("5551999999999")],
        },
      },
    ],
    test_event_code: "TEST16747",
  };

  const url = `https://graph.facebook.com/v21.0/${datasetId}/events?access_token=${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.text();

  return new Response(
    JSON.stringify({
      ok: res.ok,
      status: res.status,
      response: (() => { try { return JSON.parse(body); } catch { return body; } })(),
      instructions: res.ok
        ? "Abra Meta Events Manager → Testar eventos → o evento 'Lead' deve aparecer em ~30s (code TEST16747)."
        : "Falha na autenticação/dataset. Revise META_DATASET_ID e META_CAPI_TOKEN.",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
