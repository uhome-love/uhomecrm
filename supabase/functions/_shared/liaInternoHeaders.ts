/** Crachá interno da Lia: toda rotina que chama a lia-chat usa estes cabeçalhos. */
export function liaInternoHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-lia-cron-secret": Deno.env.get("LIA_CRON_SECRET") ?? "",
    apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
  };
}
