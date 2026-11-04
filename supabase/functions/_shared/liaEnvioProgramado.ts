import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** A gravação de parâmetros não chama este módulo. Reserva somente no caminho real de envio. */
export async function reservarEnvioLia(sb: SupabaseClient, chave: string, telefone: string, origem: "reengajamento" | "followup" | "proativo") {
  const { data, error } = await sb.rpc("lia_reservar_envio", { p_chave: chave, p_telefone: telefone, p_origem: origem });
  if (error || !data || typeof data !== "object") return false;
  return data.permitido === true;
}