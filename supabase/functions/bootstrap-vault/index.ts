import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    const upserts = [
      { name: "supabase_url", secret: SUPABASE_URL },
      { name: "supabase_service_role_key", secret: SERVICE_ROLE },
    ];

    const results: any[] = [];
    for (const s of upserts) {
      // Delete existing then insert (vault.secrets has unique name)
      await sb.rpc("vault_secret_upsert", { p_name: s.name, p_secret: s.secret }).then((r) => {
        results.push({ name: s.name, ok: !r.error, error: r.error?.message });
      });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
