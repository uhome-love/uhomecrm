/**
 * _shared/cron-auth.ts — Shared authentication for cron-only Edge Functions.
 *
 * These functions perform real side-effects (WhatsApp/email sends, bulk lead
 * mutations, report generation) and must NOT be callable by anonymous users.
 *
 * Accepted credentials:
 *   1. Header `x-cron-secret: <CRON_SECRET>` — used by pg_cron / scheduled jobs.
 *   2. Bearer token equal to the service-role key — used by internal chained calls.
 *
 * Usage:
 *   import { requireCronAuth } from "../_shared/cron-auth.ts";
 *   const denied = requireCronAuth(req);
 *   if (denied) return denied;
 */

export function requireCronAuth(req: Request): Response | null {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-cron-secret",
  };

  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const providedSecret = req.headers.get("x-cron-secret");
  if (cronSecret && providedSecret && providedSecret === cronSecret) {
    return null;
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (serviceKey && bearer && bearer === serviceKey) {
    return null;
  }

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
