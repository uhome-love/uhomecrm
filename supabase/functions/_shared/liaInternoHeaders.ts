/** Crachá interno da Lia: toda rotina que chama a lia-chat usa estes cabeçalhos. */
export function liaInternoHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-lia-cron-secret": (Deno.env.get("LIA_CRON_SECRET") ?? "").trim(),
    apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    // O gateway recusa a chave de serviço como Bearer; vai o JWT público e a senha interna identifica a rotina.
    Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}`,
  };
}
