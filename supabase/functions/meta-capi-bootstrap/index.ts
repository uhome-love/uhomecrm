// One-shot bootstrap: copies CAPI_CRON_SECRET from env into supabase vault
// so that the pg_cron job can read it and call meta-capi-dispatch.
// Idempotent. Safe to call anytime (updates vault to match env).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CAPI_CRON_SECRET");
  if (!cronSecret) {
    return new Response(JSON.stringify({ ok: false, error: "CAPI_CRON_SECRET not set in env" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase.rpc("_capi_set_cron_secret", { _secret: cronSecret });
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, message: "vault synced" }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
