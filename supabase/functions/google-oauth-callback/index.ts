// google-oauth-callback — troca code por tokens e salva
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();
  try {
    const { code, state, redirect_origin } = await req.json();
    if (!code || !state || !redirect_origin) return errorResponse("Missing params", 400);

    let parsedState: { uid: string; ts: number };
    try {
      parsedState = JSON.parse(atob(state));
    } catch {
      return errorResponse("Invalid state", 400);
    }
    if (Date.now() - parsedState.ts > 10 * 60 * 1000) return errorResponse("State expired", 400);

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    const redirectUri = `${redirect_origin}/oauth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Google token error:", tokens);
      return errorResponse(tokens.error_description || tokens.error || "Token exchange failed", 400);
    }

    // Buscar email da conta Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

    const sbAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: upsertErr } = await sbAdmin
      .from("corretor_calendar_integrations")
      .upsert(
        {
          corretor_id: parsedState.uid,
          provider: "google",
          account_email: userInfo.email ?? null,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          token_expires_at: expiresAt,
          scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
          status: "active",
          last_error: null,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "corretor_id,provider" },
      );

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      return errorResponse(upsertErr.message, 500);
    }

    return jsonResponse({ success: true, account_email: userInfo.email });
  } catch (e) {
    console.error(e);
    return errorResponse((e as Error).message, 500);
  }
});
