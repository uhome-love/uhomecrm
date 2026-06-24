// Lê quality rating e messaging tier do número Meta (WABA) via Graph API.
// Usado pelo painel da Central de Reengajamento para sinalizar saúde do número.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
    if (!phoneNumberId || !accessToken) {
      return new Response(JSON.stringify({ error: "Meta env vars missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fields = [
      "verified_name",
      "display_phone_number",
      "quality_rating",
      "messaging_limit_tier",
      "name_status",
      "throughput",
    ].join(",");

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=${fields}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "graph_error", detail: data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normaliza saída para o frontend
    const tierMap: Record<string, number> = {
      TIER_50: 50, TIER_250: 250, TIER_1K: 1000, TIER_10K: 10000,
      TIER_100K: 100000, TIER_UNLIMITED: -1,
    };
    const tierRaw = String(data?.messaging_limit_tier || "");
    const result = {
      verified_name: data?.verified_name ?? null,
      display_phone_number: data?.display_phone_number ?? null,
      quality_rating: data?.quality_rating ?? "UNKNOWN", // GREEN | YELLOW | RED | UNKNOWN
      messaging_limit_tier: tierRaw || null,
      messaging_limit: tierMap[tierRaw] ?? null, // -1 = ilimitado
      name_status: data?.name_status ?? null,
      throughput: data?.throughput ?? null,
      fetched_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
