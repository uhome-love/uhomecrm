import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * jetimob-sync — DESATIVADO
 * 
 * A sincronização via Jetimob foi desativada em 12/03/2026.
 * Motivo: Migração para integração direta via Make.com (Facebook/TikTok Ads).
 * Os leads agora entram exclusivamente via receive-meta-lead e receive-landing-lead.
 * 
 * Para reativar, remova o early-return abaixo.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("jetimob-sync: DESATIVADO — leads agora entram via Make.com (receive-meta-lead)");

  return new Response(
    JSON.stringify({
      success: true,
      message: "Sincronização Jetimob desativada. Leads entram via Make.com (receive-meta-lead).",
      disabled_at: "2026-03-12",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
