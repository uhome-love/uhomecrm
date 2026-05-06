// Shared helper — refresh Google access token if expired
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getValidGoogleAccessToken(corretorId: string): Promise<{ access_token: string; account_email: string | null } | null> {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: integ, error } = await sb
    .from("corretor_calendar_integrations")
    .select("*")
    .eq("corretor_id", corretorId)
    .eq("provider", "google")
    .eq("status", "active")
    .maybeSingle();
  if (error || !integ) return null;

  const expires = integ.token_expires_at ? new Date(integ.token_expires_at).getTime() : 0;
  if (expires > Date.now() + 60_000 && integ.access_token) {
    return { access_token: integ.access_token, account_email: integ.account_email };
  }
  if (!integ.refresh_token) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
      refresh_token: integ.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    await sb.from("corretor_calendar_integrations")
      .update({ status: "error", last_error: json.error_description || json.error || "refresh_failed" })
      .eq("id", integ.id);
    return null;
  }
  const newExpires = new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString();
  await sb.from("corretor_calendar_integrations")
    .update({ access_token: json.access_token, token_expires_at: newExpires, last_used_at: new Date().toISOString() })
    .eq("id", integ.id);
  return { access_token: json.access_token, account_email: integ.account_email };
}
