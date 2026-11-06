import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Revalida antes de abrir o aplicativo externo; falha de leitura não é permissão. */
export async function contatoPermitido(telefone: string | null | undefined): Promise<boolean> {
  if (!telefone) return false;
  const { data,error } = await supabase.rpc("check_send_allowed", { p_lead_id:null,p_phone:telefone,p_template:null });
  const permitido = !error && !!data && typeof data === "object" && !Array.isArray(data) && data.allowed === true;
  if (!permitido) toast.error(error ? "Não foi possível conferir a permissão de contato." : "Este cliente não pode receber contato por listas.");
  return permitido;
}