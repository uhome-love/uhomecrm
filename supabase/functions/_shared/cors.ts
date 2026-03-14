/**
 * _shared/cors.ts — Canonical CORS headers for all Edge Functions
 * 
 * Usage:
 *   import { corsHeaders, handleCors } from "../_shared/cors.ts";
 * 
 *   // In handler:
 *   if (req.method === "OPTIONS") return handleCors();
 *   // ... later:
 *   return new Response(body, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
 */

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Standard OPTIONS preflight response */
export function handleCors(): Response {
  return new Response(null, { headers: corsHeaders });
}

/** JSON response with CORS */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Error response with CORS */
export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}
