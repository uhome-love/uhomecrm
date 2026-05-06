// google-oauth-start — gera URL de autorização Google
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

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

    const { redirect_origin } = await req.json();
    if (!redirect_origin) return errorResponse("redirect_origin required", 400);

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    if (!clientId) return errorResponse("GOOGLE_OAUTH_CLIENT_ID not set", 500);

    const redirectUri = `${redirect_origin}/oauth/google/callback`;
    // state = userId (servirá para vincular tokens ao corretor no callback)
    const state = btoa(JSON.stringify({ uid: userId, ts: Date.now() }));

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);

    return jsonResponse({ authorize_url: url.toString() });
  } catch (e) {
    return errorResponse((e as Error).message, 500);
  }
});
