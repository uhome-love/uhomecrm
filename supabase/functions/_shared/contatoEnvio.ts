import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { classificarResposta } from "./liaRecuperaRespostas.ts";

/** Todas as portas negam envio se a leitura da proteção falhar. */
export async function contatoPodeReceber(sb: SupabaseClient, telefone: string, leadId: string | null = null, template: string | null = null): Promise<boolean> {
  const { data, error } = await sb.rpc("check_send_allowed", { p_lead_id: leadId, p_phone: telefone, p_template: template });
  return !error && !!data && data.allowed === true;
}

export async function registrarResposta(sb: SupabaseClient, args: { telefone: string; mensagem: string; payload?: string | null; evento: string; canal?: string; novoContato?: boolean }) {
  const acao = classificarResposta(args.mensagem,args.payload);
  // A tradução é feita no ponto único, com a mensagem original preservada para auditoria.
  const payload = acao === "opt_out" ? "lia_recupera_opt_out" : args.payload ?? null;
  const { data, error } = await sb.rpc("registrar_resposta_recuperacao", {
    p_telefone: args.telefone, p_mensagem: args.mensagem, p_payload: payload,
    // A recepção automática e a transição validada de retorno têm identidades diferentes.
    p_evento: args.novoContato ? `retorno:${args.evento}` : args.evento,
    p_canal: args.canal ?? "whatsapp", p_novo_contato: args.novoContato ?? false,
  });
  if (error || !data) throw new Error("Não foi possível registrar a proteção de contato");
  return data as { acao: "seguir" | "opt_out" | "ja_comprou"; bloqueado: boolean; novo_contato?: boolean; duplicada?: boolean };
}