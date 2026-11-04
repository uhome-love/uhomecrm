import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dentroJanelaEnvio, validarEnvio, type EnvioProgramado } from "./liaEnvioRegras.ts";

export async function horarioEnvioLia(sb: SupabaseClient, ignorarLegado = false) {
  const { data,error } = await sb.from("ia_config").select("lia_envio_programado").eq("id",true).maybeSingle();
  if (error || !data) return false;
  if (data.lia_envio_programado) {
    const config=data.lia_envio_programado as EnvioProgramado;
    return !validarEnvio(config) && dentroJanelaEnvio(config,new Date());
  }
  const h=new Date(Date.now()-3*3600000).getUTCHours();
  return ignorarLegado || (h>=9 && h<20);
}

/** A gravação de parâmetros não chama este módulo. Reserva somente no caminho real de envio. */
export async function reservarEnvioLia(sb: SupabaseClient, chave: string, telefone: string, origem: "reengajamento" | "followup" | "proativo") {
  const { data, error } = await sb.rpc("lia_reservar_envio", { p_chave: chave, p_telefone: telefone, p_origem: origem });
  if (error || !data || typeof data !== "object") return false;
  return data.permitido === true;
}