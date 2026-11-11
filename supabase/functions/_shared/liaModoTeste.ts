import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Regra pura: com o modo teste ligado, só o número de teste recebe (últimos 8 dígitos). */
export function modoTestePermite(cfg: { modo_teste?: boolean | null; numero_teste?: string | null } | null, to: string): boolean {
  if (!cfg) return false; // sem leitura = bloqueia
  if (cfg.modo_teste === false) return true;
  const a = String(cfg.numero_teste ?? "").replace(/\D/g, "").slice(-8);
  const b = String(to ?? "").replace(/\D/g, "").slice(-8);
  return a.length === 8 && a === b;
}

let cache: { at: number; cfg: { modo_teste: boolean | null; numero_teste: string | null } | null } | null = null;

/** Lê ia_config (cache 30s) e diz se a Lia pode mandar para `to`. Falha de leitura = bloqueia. */
export async function liaPodeEnviarModoTeste(sb: SupabaseClient, to: string, origem: string): Promise<boolean> {
  if (!cache || Date.now() - cache.at > 30_000) {
    const { data, error } = await sb.from("ia_config").select("modo_teste, numero_teste").limit(1).maybeSingle();
    cache = { at: Date.now(), cfg: error ? null : (data as any) };
  }
  const ok = modoTestePermite(cache.cfg, to);
  if (!ok) {
    console.warn(`[lia-modo-teste] bloqueado (${origem}) ***${String(to).replace(/\D/g, "").slice(-4)}`);
    await sb.from("ops_events").insert({ fn: "lia-modo-teste", level: "info", message: "bloqueado_modo_teste", category: "lia", ctx: { origem, final: String(to).replace(/\D/g, "").slice(-4) } }).then(() => {}, () => {});
  }
  return ok;
}

/** Estrito: true SÓ com o modo teste LIGADO e o número igual ao de teste. Falha de leitura = false. */
export async function ehConversaDeTeste(sb: SupabaseClient, telefone: string): Promise<boolean> {
  const { data, error } = await sb.from("ia_config").select("modo_teste, numero_teste").limit(1).maybeSingle();
  if (error || !data?.modo_teste) return false;
  const a = String((data as any).numero_teste ?? "").replace(/\D/g, "").slice(-8);
  const b = String(telefone ?? "").replace(/\D/g, "").slice(-8);
  return a.length === 8 && a === b;
}
