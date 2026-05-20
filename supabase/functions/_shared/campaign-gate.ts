// Gatekeeper global de disparo de campanha — usa system_flags.campaign_dispatch_enabled.
// Funções pausadas retornam 200 com aviso, sem qualquer side-effect.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CampaignGateResult {
  enabled: boolean;
  reason?: string;
}

export async function isCampaignDispatchEnabled(): Promise<CampaignGateResult> {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supa = createClient(url, key);
    const { data, error } = await supa
      .from("system_flags")
      .select("flag_value, reason")
      .eq("flag_name", "campaign_dispatch_enabled")
      .maybeSingle();
    if (error) {
      // Fail-safe: na dúvida, BLOQUEAR (WABA recovery).
      return { enabled: false, reason: `flag check failed: ${error.message}` };
    }
    return { enabled: !!data?.flag_value, reason: data?.reason ?? undefined };
  } catch (e) {
    return { enabled: false, reason: `flag check exception: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export function pausedResponse(fnName: string, gate: CampaignGateResult, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      paused: true,
      function: fnName,
      message: "Campaign dispatch globally paused due to WABA quality recovery — see paused_reason in reengajamento_config.",
      flag_reason: gate.reason ?? null,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
