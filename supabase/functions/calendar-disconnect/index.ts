// calendar-disconnect — revoga tokens e marca como desconectado
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return errorResponse("Unauthorized", 401);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claims, error } = await sb.auth.getClaims(auth.replace("Bearer ", ""));
    if (error || !claims?.claims) return errorResponse("Unauthorized", 401);
    const userId = claims.claims.sub as string;

    const sbAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: integ } = await sbAdmin
      .from("corretor_calendar_integrations")
      .select("refresh_token, access_token")
      .eq("corretor_id", userId)
      .eq("provider", "google")
      .maybeSingle();

    const tokenToRevoke = integ?.refresh_token || integ?.access_token;
    if (tokenToRevoke) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${tokenToRevoke}`, { method: "POST" });
    }

    await sbAdmin
      .from("corretor_calendar_integrations")
      .update({ status: "revoked", access_token: null, refresh_token: null })
      .eq("corretor_id", userId)
      .eq("provider", "google");

    return jsonResponse({ success: true });
  } catch (e) {
    return errorResponse((e as Error).message, 500);
  }
});
